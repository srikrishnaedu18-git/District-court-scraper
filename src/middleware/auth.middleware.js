"use strict";

const admin = require("../config/firebase-admin");

/**
 * requireAuth — Firebase ID Token verification middleware.
 *
 * The frontend (Firebase Client SDK) signs the user in and receives a short-lived
 * ID Token from Firebase Auth. That token is sent on every request as:
 *   Authorization: Bearer <firebase-id-token>
 * or as a fallback:
 *   x-access-token: <firebase-id-token>
 *
 * This middleware verifies the token against Firebase / Google's public keys.
 * On success it sets req.user with the decoded token payload:
 *   { uid, email, name, picture, email_verified, ... }
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token =
      (authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "") ||
      req.headers["x-access-token"] ||
      "";

    if (!token) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }

    // verifyIdToken also checks token expiry automatically
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded; // { uid, email, name, email_verified, ... }
    return next();
  } catch (err) {
    // Do not expose the specific Firebase error reason to the client
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
}

module.exports = { requireAuth };
