"use strict";

const express = require("express");

const router = express.Router();

/**
 * GET /api/auth/me
 *
 * Public route. Returns a simple status payload.
 */
router.get("/me", (_req, res) => {
  return res.json({
    success: true,
    status: 1,
    message: "OK",
    result: {},
  });
});

module.exports = router;
