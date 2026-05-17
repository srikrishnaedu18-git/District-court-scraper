"use strict";

/**
 * requestLogger — logs every incoming request as structured JSON.
 * Also flags suspicious burst traffic: if the same IP fires more than
 * SUSPICIOUS_COUNT requests within WINDOW_MS, an alert is logged.
 *
 * State is held in-memory (Map). Entries older than WINDOW_MS are pruned
 * on each request so memory stays bounded.
 */

const WINDOW_MS = 10_000;    // 10-second sliding window
const SUSPICIOUS_COUNT = 20; // alert threshold per window

/** @type {Map<string, number[]>} ip → array of request timestamps */
const ipWindows = new Map();

function requestLogger(req, _res, next) {
  const now = Date.now();
  req._requestStartAt = now;

  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  const userId = req.user?.uid || req.user?.userId || null;

  // --- Suspicious rate detection ---
  const times = (ipWindows.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  times.push(now);
  ipWindows.set(ip, times);

  if (times.length > SUSPICIOUS_COUNT) {
    console.log(
      JSON.stringify({
        alert: "SUSPICIOUS_RATE",
        ip,
        count: times.length,
        window_ms: WINDOW_MS,
        timestamp: new Date(now).toISOString(),
      }),
    );
  }
  // ----------------------------------

  console.log(
    JSON.stringify({
      timestamp: new Date(now).toISOString(),
      ip,
      method: req.method,
      path: req.originalUrl,
      userAgent: req.headers["user-agent"] || "",
      userId,
    }),
  );

  return next();
}

module.exports = {
  requestLogger,
};
