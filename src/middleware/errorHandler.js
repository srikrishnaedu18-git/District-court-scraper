"use strict";

const isProd = process.env.NODE_ENV === "production";

function errorHandler(err, _req, res, _next) {
  const status = err.statusCode || err.status || 500;

  // In production never expose internal error details
  const message = isProd
    ? status >= 500
      ? "Something went wrong"
      : err.message || "Request failed"
    : err.message || "Internal Server Error";

  return res.status(status).json({
    success: false,
    status: 0,
    message,
    result: {},
    rawHtml: null,
  });
}

module.exports = {
  errorHandler,
};
