"use strict";

require("dotenv").config();
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const axios = require("axios");
const crypto = require("crypto");
const { buildErrorResponse } = require("../src/utils/errorResponse");

const app = express();
const PORT = Number(process.env.PORT || process.env.GATEWAY_PORT || 4000);
const INTERNAL_URL = process.env.INTERNAL_SERVICE_URL || "http://127.0.0.1:3000";
const HMAC_SECRET = process.env.INTERNAL_HMAC_SECRET || process.env.HMAC_SECRET;

app.use(helmet());
app.use(cors());
app.use(rateLimit({ windowMs: 60 * 1000, max: 120, standardHeaders: true, legacyHeaders: false }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use((req, _res, next) => {
  req.id = req.headers["x-request-id"] || crypto.randomUUID();
  next();
});

function buildSignature(timestamp, body) {
  return crypto.createHmac("sha256", HMAC_SECRET).update(`${timestamp}:${JSON.stringify(body || {})}`).digest("hex");
}

function forwardHeaders(req) {
  const headers = { ...req.headers };
  delete headers.host;
  delete headers.connection;
  delete headers["content-length"];
  delete headers["x-signature"];
  delete headers["x-timestamp"];
  headers["x-request-id"] = req.id;

  if (req.path.startsWith("/api")) {
    if (!HMAC_SECRET) throw new Error("Missing INTERNAL_HMAC_SECRET/HMAC_SECRET");
    const timestamp = Date.now().toString();
    headers["x-timestamp"] = timestamp;
    headers["x-signature"] = buildSignature(timestamp, req.body);
  }

  return headers;
}

app.use(async (req, res) => {
  try {
    const response = await axios({
      method: req.method,
      url: `${INTERNAL_URL}${req.originalUrl}`,
      headers: forwardHeaders(req),
      data: req.method === "GET" || req.method === "HEAD" ? undefined : req.body,
      validateStatus: () => true,
      timeout: 60000,
    });

    res.status(response.status);
    for (const [key, value] of Object.entries(response.headers || {})) {
      if (key.toLowerCase() === "transfer-encoding") continue;
      res.setHeader(key, value);
    }
    return res.send(response.data);
  } catch (error) {
    return res.status(502).json(
      buildErrorResponse({
        status: 502,
        code: "GATEWAY_PROXY_ERROR",
        message: "Gateway proxy error",
        area: "gateway",
        reason: "The gateway could not reach or complete the request to the internal backend.",
        details: {
          internalUrl: INTERNAL_URL,
          cause: error.message,
          code: error.code || null,
        },
        path: req.originalUrl,
        method: req.method,
        requestId: req.id,
      })
    );
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`District gateway listening on ${PORT}, proxying to ${INTERNAL_URL}`);
});
