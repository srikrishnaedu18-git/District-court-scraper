"use strict";

const { sendError } = require("../utils/errorResponse");

function notFound(req, res) {
  return sendError(res, req, {
    status: 404,
    code: "ROUTE_NOT_FOUND",
    message: "Route not found",
    area: "internal",
    reason: "No backend route matches this method and path.",
  });
}

module.exports = { notFound };
