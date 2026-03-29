"use strict";

const { COMMON_MESSAGES } = require("./constants");
const { firstDefined } = require("./utils/common");

function validateInit(_req, _res, next) {
  next();
}

function validateCourtDetails(req, res, next) {
  const sessionId = req.body.sessionId;
  const complexCode = firstDefined(req.body.complexCode, req.body.complex_code);
  const stateCode = firstDefined(req.body.stateCode, req.body.state_code);
  const distCode = firstDefined(req.body.distCode, req.body.dist_code);

  if (!sessionId || !complexCode || !stateCode || !distCode) {
    return res.status(400).json({ success: false, error: COMMON_MESSAGES.MISSING_REQUIRED_FIELDS });
  }
  return next();
}

function validateSessionIdQuery(req, res, next) {
  if (!req.query.sessionId) {
    return res.status(400).json({ success: false, error: COMMON_MESSAGES.MISSING_SESSION_ID });
  }
  return next();
}

function validateDistricts(req, res, next) {
  const sessionId = firstDefined(req.body.sessionId, req.query.sessionId);
  const stateCode = firstDefined(req.body.stateCode, req.body.state_code, req.query.stateCode, req.query.state_code);
  if (!sessionId) {
    return res.status(400).json({ success: false, error: COMMON_MESSAGES.MISSING_SESSION_ID });
  }
  if (!stateCode) {
    return res.status(400).json({ success: false, error: COMMON_MESSAGES.MISSING_STATE_CODE });
  }
  return next();
}

function validateCourts(req, res, next) {
  const sessionId = firstDefined(req.body.sessionId, req.query.sessionId);
  const stateCode = firstDefined(req.body.stateCode, req.body.state_code, req.query.stateCode, req.query.state_code);
  const distCode = firstDefined(req.body.distCode, req.body.dist_code, req.query.distCode, req.query.dist_code);
  if (!sessionId) {
    return res.status(400).json({ success: false, error: COMMON_MESSAGES.MISSING_SESSION_ID });
  }
  if (!stateCode || !distCode) {
    return res.status(400).json({ success: false, error: COMMON_MESSAGES.MISSING_DISTRICT_FIELDS });
  }
  return next();
}

module.exports = {
  validateInit,
  validateCourtDetails,
  validateSessionIdQuery,
  validateDistricts,
  validateCourts,
};
