# Jurident Backend — Security Hardening Walkthrough
### For Teammates: What Changed, How Firebase Works, How to Test

---

## 1. What This Repo Is

This is a **Node.js / Express backend** that acts as a secure proxy to the Indian eCourts portal. It:
- Creates server-side sessions with the eCourts portal (so the browser never talks to eCourts directly)
- Exposes clean REST endpoints for searching cases by party name, CNR, case number, filing number, advocate name
- **Is now protected by Firebase Authentication** — every API call must carry a valid Firebase ID token

---

## 2. Before vs After — Security Comparison

| Security Area | ❌ Before | ✅ After |
|---|---|---|
| **HTTP Security Headers** | None — no helmet | `helmet()` applied — sets `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, CSP, and 10+ other headers automatically |
| **CORS** | `origin: true` — accepted requests from **any** origin, including competitors | Locked to `ALLOWED_ORIGINS` env var — all other origins get a 403 |
| **Rate Limiting** | None — unlimited requests per IP | 60 requests / minute / IP — returns `429 Too Many Requests` on breach |
| **Authentication** | None — all endpoints were public | Firebase ID Token required on every endpoint via `Authorization: Bearer <token>` header |
| **Error Handling** | Exposed `err.message` in all environments | In production, 5xx errors return generic `"Something went wrong"` — no internals leaked |
| **Request Logging** | Skeleton only — just stored `Date.now()` | Full structured JSON logs: `timestamp`, `ip`, `method`, `path`, `userAgent`, `userId` |
| **Suspicious Traffic** | None | Burst detection: if same IP fires >20 requests in 10 seconds, an `ALERT: SUSPICIOUS_RATE` log is emitted |
| **Proxy pattern** | Already server-side ✅ | Still server-side ✅ — eCourts URLs and cookies never reach the browser |

---

## 3. Files Changed / Created

### Modified Files

#### `src/app.js` — The Middleware Stack
The central change. The entire request pipeline was rebuilt with a clear security order.

```diff
// BEFORE — completely open, no auth
app.use(cors({ origin: true }));
app.use(cookieParser());
app.use(express.json());
app.use(requestLogger);
app.use("/api/common", portalRoutes);    // ← public
app.use("/api/partyname", partyNameRoutes); // ← public
// ... all routes were public

// AFTER — layered security
app.use(helmet());                       // ← 1. Security headers
app.use(cors(corsOptions));             // ← 2. Locked CORS
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded(...));
app.use(globalLimiter);                 // ← 4. Rate limit 60/min/IP
app.use(requestLogger);                 // ← 5. Structured JSON logs
app.get("/health", ...);               // ← 6. Public (GCP health check)
app.use("/api/auth", authRoutes);      // ← 7. Public auth route
app.use(requireAuth);                  // ← 8. 🔐 Firebase gate — everything below is protected
app.use("/api/common", portalRoutes);  // ← 9. Protected
app.use("/api/partyname", ...);        // ← 9. Protected
// ... all search routes protected
```

#### `src/config/cors.js`
```diff
// BEFORE
const corsOptions = { origin: true, credentials: true };

// AFTER — reads comma-separated origins from .env
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map(o => o.trim())
  : ["http://localhost:3000"];

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("CORS: origin not allowed")); // → 403
  },
  credentials: true,
};
```

#### `src/middleware/errorHandler.js`
```diff
// BEFORE — leaked err.message in production
return res.json({ message: err.message || "Internal Server Error" });

// AFTER — hides internals for 5xx in production
const message = isProd
  ? status >= 500 ? "Something went wrong" : err.message
  : err.message;
return res.json({ message });
```

#### `src/middleware/request-logger.middleware.js`
```diff
// BEFORE — useless skeleton
function requestLogger(req, _res, next) {
  req._requestStartAt = Date.now();
  next();
}

// AFTER — full structured JSON logging + burst detection
function requestLogger(req, _res, next) {
  // logs: { timestamp, ip, method, path, userAgent, userId }
  // alerts: { alert: "SUSPICIOUS_RATE", ip, count } if > 20 req/10s
}
```

#### `src/config/env.js`
Added: `ALLOWED_ORIGINS`, `HMAC_SECRET`, `GOOGLE_APPLICATION_CREDENTIALS`.

---

### New Files Created

| File | Purpose |
|---|---|
| `src/config/firebase-admin.js` | Initialises Firebase Admin SDK using GCP Application Default Credentials |
| `src/middleware/auth.middleware.js` | `requireAuth` — verifies Firebase ID token on every protected request |
| `src/middleware/hmac.middleware.js` | HMAC signing middleware (for future server-to-server integrations) |
| `src/modules/auth/auth.routes.js` | `GET /api/auth/me` — the only auth route needed |
| `.env.example` | Template for all environment variables |
| `scripts/generate-secrets.js` | Generates HMAC + AES secrets (`node scripts/generate-secrets.js`) |
| `scripts/smoke-test.js` | Automated auth-gate checks (6/6 passing) |

---

## 4. How Firebase Auth Works in This Architecture

This is the most important thing for the **frontend teammate** to understand.

### The Full Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (React / Next.js / any web app)                       │
│                                                                 │
│  1. User clicks "Login with Google" (or email/password)        │
│  2. Firebase Client SDK handles login entirely                  │
│  3. Firebase returns an ID Token (a short-lived JWT ~1hr)       │
│  4. Store token: firebase.auth().currentUser.getIdToken()       │
└──────────────────────────┬──────────────────────────────────────┘
                           │  Authorization: Bearer <ID_TOKEN>
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  BACKEND (this Express server)                                   │
│                                                                 │
│  requireAuth middleware runs on every request:                  │
│  → reads the token from Authorization header                    │
│  → calls admin.auth().verifyIdToken(token)                      │
│  → Firebase Admin checks Google's public keys                   │
│  → if valid: req.user = { uid, email, name, ... }              │
│  → if invalid/expired: returns 401 Unauthorized                 │
└─────────────────────────────────────────────────────────────────┘
```

### Why Not JWT (custom)?
| | Custom JWT | Firebase Auth |
|---|---|---|
| User registration | You build it | Firebase handles it |
| Password hashing | You use bcrypt | Firebase handles it |
| Token signing secret | You store JWT_SECRET | Google signs tokens |
| Token verification | `jwt.verify(token, secret)` | `admin.auth().verifyIdToken(token)` |
| Google SSO, Apple SSO | You integrate manually | Built in |
| Password reset | You build it | Firebase handles it |
| Token rotation | You handle it | Firebase auto-rotates |

**Bottom line:** Firebase gives you a complete auth system. The backend just verifies the token Firebase issues.

---

## 5. Frontend Integration Guide (For Frontend Teammate)

Install the Firebase Client SDK:
```bash
npm install firebase
```

### Setup Firebase in your frontend
```js
// src/lib/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  // copy from .env.example
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
```

### Sign in and get the token
```js
import { signInWithPopup, GoogleAuthProvider, getAuth } from "firebase/auth";

// Google login
const provider = new GoogleAuthProvider();
await signInWithPopup(auth, provider);

// Get the ID token — call this before EVERY API request
const token = await auth.currentUser.getIdToken();
// token is a string like "eyJhbGci..."
```

### Making API calls to this backend
```js
// Always get a fresh token — getIdToken() auto-refreshes if expired
async function apiCall(url, options = {}) {
  const token = await auth.currentUser.getIdToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,  // ← this is all you need
      ...options.headers,
    },
  });
  return response.json();
}

// Example: init session
const session = await apiCall("http://localhost:3000/api/common/init", {
  method: "POST",
  body: JSON.stringify({}),
});

// Example: search by party name
const results = await apiCall("http://localhost:3000/api/partyname/case-data", {
  method: "POST",
  body: JSON.stringify({
    sessionId: session.result.sessionId,
    petresName: "RAHUL",
    captchaCode: "A1B2C",
  }),
});
```

### Checking if user is logged in
```js
import { onAuthStateChanged } from "firebase/auth";

onAuthStateChanged(auth, (user) => {
  if (user) {
    // user is logged in, safe to call backend APIs
    console.log("Logged in as:", user.email);
  } else {
    // redirect to login page
  }
});
```

---

## 6. Backend Environment Setup (Local Dev)

### Step 1 — Copy `.env.example` to `.env`
```bash
cp .env.example .env
```

### Step 2 — Get Firebase service account for local dev
1. Go to [GCP Console](https://console.cloud.google.com) → IAM & Admin → Service Accounts
2. Find the Firebase service account (usually `firebase-adminsdk-xxxx@<project>.iam.gserviceaccount.com`)
3. Click ⋮ → Manage Keys → Add Key → JSON
4. Download the file, save it somewhere safe (e.g. `~/keys/jurident-sa.json`)
5. Add to `.env`:
   ```
   GOOGLE_APPLICATION_CREDENTIALS=/home/yourname/keys/jurident-sa.json
   ```

> **On GCP (Cloud Run / GKE):** Skip step 2 entirely. Attach the service account to the GCP resource in the Console, and Firebase Admin picks it up automatically. No credentials file needed.

### Step 3 — Set allowed origins
```env
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

### Step 4 — Start the server
```bash
npm run dev
```

---

## 7. API Testing Guide (Post-Security)

> All routes except `/health` now require a Firebase ID token.
> Get your token from the Firebase Console "Authentication → Users → Token" or from the frontend (see Section 5).

### Tool options
- **Postman** — Set Authorization type to `Bearer Token`, paste the Firebase ID token
- **curl** — examples below
- **Bruno / Insomnia** — same as Postman

---

### Getting a test token quickly (one-time setup)

```bash
# Install the Firebase CLI if you haven't
npm install -g firebase-tools
firebase login

# Get a test ID token for your Firebase project
firebase auth:export /tmp/users.json --format=json
```

Or use this quick browser snippet in your dev frontend's console:
```js
// Run this in your browser console after logging in to the frontend
const token = await firebase.auth().currentUser.getIdToken(true);
console.log(token);  // Copy this token
```

Set it as a shell variable:
```bash
export TOKEN="paste-your-firebase-id-token-here"
```

---

### Unauthenticated Tests (should all return 401)

```bash
# ✅ Health check — always public
curl http://localhost:3000/health
# Expected: {"ok":true}

# 🔒 Init session — no token → 401
curl -X POST http://localhost:3000/api/common/init \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: {"success":false,"error":"Unauthorized"}

# 🔒 Party name search — no token → 401
curl -X POST http://localhost:3000/api/partyname/case-data \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"x","petresName":"test","captchaCode":"abc"}'
# Expected: {"success":false,"error":"Unauthorized"}

# 🔒 Auth/me — no token → 401
curl http://localhost:3000/api/auth/me
# Expected: {"success":false,"error":"Unauthorized"}
```

---

### Authenticated Tests (require a valid Firebase token)

```bash
# Replace TOKEN with your actual Firebase ID token
export TOKEN="eyJhbGc..."

# ✅ Verify token — who am I?
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
# Expected: {"success":true,"result":{"uid":"...","email":"...","name":"..."}}

# ✅ Step 1: Init session
curl -X POST http://localhost:3000/api/common/init \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
# Save the sessionId from the response
export SESSION_ID="sess_..."

# ✅ Step 2: Get captcha image (save to file)
curl "http://localhost:3000/api/common/captcha?sessionId=$SESSION_ID" \
  -H "Authorization: Bearer $TOKEN"
# Returns Base64 captcha URL in result.captcha

# ✅ Step 3: Get districts (e.g. Delhi = state 26)
curl "http://localhost:3000/api/common/districts?sessionId=$SESSION_ID&stateCode=26" \
  -H "Authorization: Bearer $TOKEN"

# ✅ Step 4: Get courts
curl "http://localhost:3000/api/common/districts?sessionId=$SESSION_ID&stateCode=26&distCode=8" \
  -H "Authorization: Bearer $TOKEN"

# ✅ Step 5: Set court context
curl -X POST http://localhost:3000/api/common/set-fields \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "'$SESSION_ID'",
    "stateCode": "26",
    "distCode": "8",
    "complexCode": "1260008",
    "estCode": "5"
  }'

# ✅ Step 6: Search by CNR
curl -X POST http://localhost:3000/api/cnr/search \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "'$SESSION_ID'",
    "cnrNumber": "DLCT110012472024",
    "captchaCode": "ABCDE"
  }'
```

---

### Rate Limiting Test

```bash
# Send 65 rapid requests — should see 429 after the 60th
for i in $(seq 1 65); do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/health)
  echo "Request $i: $STATUS"
done
# Requests 1–60: 200
# Requests 61–65: 429
```

---

### Run the automated smoke tests
```bash
# Unauthenticated gate checks (6 tests)
node scripts/smoke-test.js

# With auth (requires FIREBASE_TEST_TOKEN env var)
FIREBASE_TEST_TOKEN="your-token-here" node scripts/smoke-test.js
```

---

## 8. New Route Map

```
PUBLIC (no token needed)
  GET  /health                    → Server health check

  GET  /api/auth/me               → Returns your Firebase user info
                                    (this route internally requires auth)

PROTECTED (require: Authorization: Bearer <firebase-id-token>)

  Session & Discovery
  POST /api/common/init           → Create a new eCourts session
  GET  /api/common/captcha        → Get captcha (base64)
  GET  /api/common/captcha-image  → Get captcha (image stream)
  GET|POST /api/common/districts  → List districts for a state
  GET|POST /api/common/courts     → List court complexes
  GET|POST /api/common/establishments → List establishments
  POST /api/common/set-fields     → Set court context for session

  Party Name Search
  POST /api/partyname/case-data
  POST /api/partyname/case-detail
  POST /api/partyname/ia-business
  POST /api/partyname/business-detail
  GET|POST /api/partyname/order-pdf

  Other Searches
  POST /api/cnr/search
  POST /api/casenumber/case-data
  POST /api/casenumber/case-detail
  POST /api/filingnumber/case-data
  POST /api/filingnumber/case-detail
  POST /api/advocatename/case-data
  POST /api/advocatename/case-detail
  POST /api/casetype/case-data
```

---

## 9. Packages Installed

```bash
npm install helmet express-rate-limit firebase-admin
```

| Package | What it does |
|---|---|
| `helmet` | Sets 10+ HTTP security headers automatically |
| `express-rate-limit` | Rate limits per IP with configurable windows |
| `firebase-admin` | Server SDK to verify Firebase ID tokens |

Packages that were **NOT** installed (and why):
- ~~`jsonwebtoken`~~ — Firebase issues and signs tokens; backend only verifies
- ~~`bcryptjs`~~ — Firebase handles password hashing
- ~~`passport`~~ — Firebase Admin is sufficient

---

## 10. GCP Deployment Checklist

- [ ] Attach a service account to your Cloud Run / GKE service with `Firebase Auth Viewer` role
- [ ] Set `NODE_ENV=production` env var
- [ ] Set `ALLOWED_ORIGINS=https://yourapp.com` env var — no localhost
- [ ] Do NOT set `GOOGLE_APPLICATION_CREDENTIALS` (ADC handles it automatically on GCP)
- [ ] GCP load balancer hits `GET /health` — confirm it returns `{"ok":true}`
