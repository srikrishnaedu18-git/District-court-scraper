#!/usr/bin/env node
"use strict";

/**
 * generate-secrets.js
 *
 * Prints fresh secure random values for all secrets needed in .env.
 * Run once and paste the output into your .env file. Never commit .env.
 *
 * Usage:
 *   node scripts/generate-secrets.js
 */

const crypto = require("crypto");

const hmacSecret = crypto.randomBytes(32).toString("hex");
const aesKey     = crypto.randomBytes(32).toString("hex");

console.log("# ─── Paste these into your .env file ─────────────────────────────────");
console.log(`HMAC_SECRET=${hmacSecret}`);
console.log(`AES_KEY_HEX=${aesKey}`);
console.log("# ──────────────────────────────────────────────────────────────────────");
console.log("#");
console.log("# NOTE: JWT_SECRET is not needed — Firebase Admin verifies tokens.");
console.log("# For Firebase on GCP, no extra secret is required (uses ADC).");
console.log("# For local dev, set:");
console.log("#   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json");
