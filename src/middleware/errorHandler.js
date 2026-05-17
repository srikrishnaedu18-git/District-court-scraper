"use strict";

const { sendError } = require("../utils/errorResponse");

function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const isBodyParserError = err.type === "entity.parse.failed";
  const status = isBodyParserError ? 400 : err.statusCode || err.status || 500;
  const message = isBodyParserError ? "Invalid JSON body" : err.message || "Internal Server Error";

  return sendError(res, req, {
    status,
    code: err.code || (isBodyParserError ? "INVALID_JSON_BODY" : status >= 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_ERROR"),
    message: process.env.NODE_ENV === "production" && status >= 500 ? "Something went wrong" : message,
    area: err.area || "internal",
    reason: err.reason || message,
    details: process.env.NODE_ENV === "production" ? err.details || null : { ...(err.details || {}), stack: err.stack },
  });
}

module.exports = { errorHandler };
