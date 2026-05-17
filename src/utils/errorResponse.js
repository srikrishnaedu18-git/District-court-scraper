function buildErrorResponse({
  status = 500,
  code = "INTERNAL_SERVER_ERROR",
  message = "Something went wrong",
  area = "internal",
  reason,
  details,
  path,
  method,
  requestId,
}) {
  return {
    ok: false,
    error: {
      code,
      message,
      area,
      reason: reason || message,
      status,
      details: details || null,
    },
    request: {
      method,
      path,
      requestId: requestId || null,
    },
  };
}

function sendError(res, req, options) {
  const status = options.status || 500;
  return res.status(status).json(
    buildErrorResponse({
      ...options,
      status,
      path: req.originalUrl,
      method: req.method,
      requestId: req.id || req.headers["x-request-id"],
    })
  );
}

function createHttpError(message, { status = 500, code, area, reason, details } = {}) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  err.area = area;
  err.reason = reason || message;
  err.details = details;
  return err;
}

module.exports = { buildErrorResponse, sendError, createHttpError };
