"use strict";

/**
 * HMAC Request Signing — verifyHmac middleware.
 *
 * Use this on server-to-server routes only (e.g. internal microservice calls).
 *
 * ⚠️  NOTE: If this middleware is applied to browser-facing routes, HMAC_SECRET
 * must be exposed to the browser to generate signatures — that defeats the
 * cryptographic guarantee. For browser clients, Firebase Auth (requireAuth) is
 * sufficient. Keep verifyHmac for trusted backend-to-backend calls only.
 *
 * Request must include:
 *   x-timestamp  : Unix timestamp in ms (string)
 *   x-signature  : HMAC-SHA256 of `${timestamp}:${JSON.stringify(req.body)}`
 *
 * Replay protection: reject requests where timestamp is > 30 seconds old.
 */

const crypto = require("crypto");

const WINDOW_MS = 30_000; // 30 seconds

function verifyHmac(req, res, next) {
  const secret = process.env.HMAC_SECRET;
  if (!secret) {
    // HMAC not configured — skip silently (allows disabling per environment)
    return next();
  }

  const timestamp = req.headers["x-timestamp"];
  const signature = req.headers["x-signature"];

  if (!timestamp || !signature) {
    return res.status(401).json({ success: false, error: "Invalid signature" });
  }

  // Replay protection
  const age = Date.now() - Number(timestamp);
  if (Number.isNaN(age) || age > WINDOW_MS || age < -WINDOW_MS) {
    return res.status(401).json({ success: false, error: "Invalid signature" });
  }

  // Compute expected HMAC
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}:${JSON.stringify(req.body)}`)
    .digest("hex");

  // Timing-safe comparison to prevent timing attacks
  const expectedBuf = Buffer.from(expected, "hex");
  let signatureBuf;
  try {
    signatureBuf = Buffer.from(signature, "hex");
  } catch {
    return res.status(401).json({ success: false, error: "Invalid signature" });
  }

  if (
    expectedBuf.length !== signatureBuf.length ||
    !crypto.timingSafeEqual(expectedBuf, signatureBuf)
  ) {
    return res.status(401).json({ success: false, error: "Invalid signature" });
  }

  return next();
}

module.exports = { verifyHmac };
