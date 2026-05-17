"use strict";

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:3000"];

const corsOptions = {
  origin(origin, callback) {
    // Allow server-to-server requests (no origin header) and whitelisted origins
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(Object.assign(new Error("CORS: origin not allowed"), { statusCode: 403 }));
  },
  credentials: true,
};

module.exports = {
  corsOptions,
};
