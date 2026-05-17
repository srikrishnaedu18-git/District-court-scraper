"use strict";

require("dotenv").config();

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT || 3000),
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "http://localhost:3000",
  HMAC_SECRET: process.env.HMAC_SECRET || "",
  // On GCP, Firebase Admin uses Application Default Credentials automatically.
  // Set GOOGLE_APPLICATION_CREDENTIALS locally for dev.
  GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS || "",
};

module.exports = env;
