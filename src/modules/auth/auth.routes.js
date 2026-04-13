"use strict";

const express = require("express");
const { requireAuth } = require("../../middleware/auth.middleware");

const router = express.Router();

/**
 * GET /api/auth/me
 *
 * Protected route. Returns the decoded Firebase token payload for the
 * authenticated user. Useful for the frontend to confirm token validity
 * and retrieve user metadata (uid, email, name) without an extra Firestore call.
 *
 * The frontend should call this once after sign-in to verify the backend
 * is accepting the token, then cache the result.
 */
router.get("/me", requireAuth, (req, res) => {
  const { uid, email, name, picture, email_verified } = req.user;
  return res.json({
    success: true,
    status: 1,
    message: "Authenticated",
    result: { uid, email, name, picture, email_verified },
  });
});

module.exports = router;
