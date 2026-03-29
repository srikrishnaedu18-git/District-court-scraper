"use strict";

function errorHandler(err, _req, res, _next) {
  const status = err.statusCode || err.status || 500;
  return res.status(status).json({
    success: false,
    status: 0,
    message: err.message || "Internal Server Error",
    result: {},
    rawHtml: null,
  });
}

module.exports = {
  errorHandler,
};
