"use strict";

const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const { sendError } = require("./utils/errorResponse");

const { corsOptions } = require("./config/cors");
const { requestLogger } = require("./middleware/request-logger.middleware");
const { verifyHmac } = require("./middleware/hmac.middleware");

const authRoutes = require("./modules/auth/auth.routes");
const portalRoutes = require("./modules/portal/portal.routes");
const advocateNameRoutes = require("./modules/searches/advocate-name/advocate-name.routes");
const caseNumberRoutes = require("./modules/searches/case-number/case-number.routes");
const caseTypeRoutes = require("./modules/searches/case-type/case-type.routes");
const cnrRoutes = require("./modules/searches/cnr/cnr.routes");
const filingNumberRoutes = require("./modules/searches/filing-number/filing-number.routes");
const partyNameRoutes = require("./modules/searches/party-name/party-name.routes");
const { notFound } = require("./middleware/notFound");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();

// ─── 1. Security headers ────────────────────────────────────────────────────
app.use(helmet());

app.use((req, _res, next) => {
  req.id = req.headers["x-request-id"] || crypto.randomUUID();
  next();
});

// ─── 2. CORS (locked to ALLOWED_ORIGINS) ────────────────────────────────────
app.use(cors(corsOptions));

// ─── 3. Body / cookie parsers ────────────────────────────────────────────────
app.use(cookieParser());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// ─── 4. Global rate limiter (60 req / min / IP) ──────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => sendError(res, req, {
    status: 429,
    code: "RATE_LIMITED",
    message: "Too many requests",
    area: "internal",
    reason: "The backend rate limit was exceeded.",
    details: { windowMs: 60 * 1000, max: 60 },
  }),
});
app.use(globalLimiter);

// ─── 5. Request logger (runs after body parsing so req.body is available) ────
app.use(requestLogger);

// ─── 6. Health check (no auth — used by GCP load balancer / uptime checks) ──
app.get("/health", (_req, res) => res.json({ ok: true }));

// ─── 7. Auth routes — PUBLIC (no token needed) ──────────────────────────────
app.use("/api/auth", authRoutes);

// ─── 8. HMAC verification for API traffic (signature expected from external gateway) ───────────
app.use("/api", verifyHmac);

// ─── 9. API routes ───────────────────────────────────────────────────────────
app.use("/api/common", portalRoutes);
app.use("/api/advocatename", advocateNameRoutes);
app.use("/api/casenumber", caseNumberRoutes);
app.use("/api/casetype", caseTypeRoutes);
app.use("/api/cnr", cnrRoutes);
app.use("/api/filingnumber", filingNumberRoutes);
app.use("/api/partyname", partyNameRoutes);

// ─── 10. Catch-all handlers ──────────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

module.exports = app;
