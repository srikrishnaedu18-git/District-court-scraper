"use strict";

const crypto = require("crypto");
const { sendError } = require("../utils/errorResponse");

const WINDOW_MS = 30_000;

function verifyHmac(req, res, next) {
  const secret = process.env.INTERNAL_HMAC_SECRET || process.env.HMAC_SECRET;
  if (!secret) {
    return sendError(res, req, { status: 500, code: "HMAC_SECRET_MISSING", message: "Internal Server Error", area: "internal", reason: "INTERNAL_HMAC_SECRET/HMAC_SECRET is not configured on the backend." });
  }

  const timestamp = req.headers["x-timestamp"];
  const signature = req.headers["x-signature"];

  if (!timestamp || !signature) {
    return sendError(res, req, { status: 401, code: "MISSING_INTERNAL_SIGNATURE", message: "Missing internal request signature", area: "internal", reason: "The backend only accepts signed requests from the gateway.", details: { missingHeaders: [...(!signature ? ["x-signature"] : []), ...(!timestamp ? ["x-timestamp"] : [])] } });
  }

  const age = Date.now() - Number(timestamp);
  if (Number.isNaN(age) || age > WINDOW_MS || age < -WINDOW_MS) {
    return sendError(res, req, { status: 401, code: "INTERNAL_SIGNATURE_EXPIRED", message: "Internal request signature expired", area: "internal", reason: "The signed request timestamp is outside the allowed 30 second window." });
  }

  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}:${JSON.stringify(req.body || {})}`).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  let signatureBuf;
  try {
    signatureBuf = Buffer.from(signature, "hex");
  } catch {
    return sendError(res, req, { status: 401, code: "INVALID_INTERNAL_SIGNATURE", message: "Invalid internal request signature", area: "internal", reason: "The gateway signature did not match the backend HMAC secret and request body." });
  }

  if (expectedBuf.length !== signatureBuf.length || !crypto.timingSafeEqual(expectedBuf, signatureBuf)) {
    return sendError(res, req, { status: 401, code: "INVALID_INTERNAL_SIGNATURE", message: "Invalid internal request signature", area: "internal", reason: "The gateway signature did not match the backend HMAC secret and request body." });
  }

  return next();
}

module.exports = { verifyHmac };
