"use strict";

const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const { corsOptions } = require("./config/cors");
const { requestLogger } = require("./middleware/request-logger.middleware");
const { requireAuth } = require("./middleware/auth.middleware");

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

// ─── 2. CORS (locked to ALLOWED_ORIGINS) ────────────────────────────────────
app.use(cors(corsOptions));

// ─── 3. Body / cookie parsers ────────────────────────────────────────────────
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── 4. Global rate limiter (60 req / min / IP) ──────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests" },
});
app.use(globalLimiter);

// ─── 5. Request logger (runs after body parsing so req.body is available) ────
app.use(requestLogger);

// ─── 6. Health check (no auth — used by GCP load balancer / uptime checks) ──
app.get("/health", (_req, res) => res.json({ ok: true }));

// ─── 7. Auth routes — PUBLIC (no token needed) ──────────────────────────────
//   GET /api/auth/me is internally protected by requireAuth inside its router
app.use("/api/auth", authRoutes);

// ─── 8. Firebase token gate — ALL routes below require a valid Firebase ID token
app.use(requireAuth);

// ─── 9. Protected routes ─────────────────────────────────────────────────────
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
