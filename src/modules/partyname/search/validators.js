"use strict";

const { firstDefined } = require("./utils/common");
const { MESSAGES } = require("./constants");

function validateCaseData(req, res, next) {
  const petresName = firstDefined(req.body.petresName, req.body.petres_name);
  const captchaCode = firstDefined(req.body.captchaCode, req.body.fcaptcha_code);
  if (!req.body.sessionId || !petresName || !captchaCode) {
    return res.status(400).json({
      success: false,
      status: 0,
      error: MESSAGES.MISSING_CASE_DATA_FIELDS,
    });
  }
  return next();
}

function validateCaseDetail(req, res, next) {
  const caseNo = firstDefined(req.body.caseNo, req.body.case_no);
  const courtCode = firstDefined(req.body.courtCode, req.body.court_code);
  if (!req.body.sessionId) {
    return res.status(400).json({ success: false, error: MESSAGES.MISSING_SESSION_ID });
  }
  if (!caseNo || !req.body.cino || !courtCode) {
    return res.status(400).json({ success: false, error: MESSAGES.MISSING_CASE_DETAIL_FIELDS });
  }
  return next();
}

function validateIaBusiness(req, res, next) {
  if (!req.body.sessionId) {
    return res.status(400).json({ success: false, error: MESSAGES.MISSING_SESSION_ID });
  }
  return next();
}

function validateBusinessDetailPost(req, res, next) {
  if (!req.body.sessionId) {
    return res.status(400).json({ success: false, error: MESSAGES.MISSING_SESSION_ID });
  }
  return next();
}

function validateBusinessDetailGet(req, res, next) {
  if (!req.query.sessionId) {
    return res.status(400).json({ success: false, error: MESSAGES.MISSING_SESSION_ID });
  }
  return next();
}

function validateOrderPdfPost(req, res, next) {
  if (!req.body.sessionId) {
    return res.status(400).json({ success: false, error: MESSAGES.MISSING_SESSION_ID });
  }
  return next();
}

function validateOrderPdfGet(req, res, next) {
  const normalV = firstDefined(req.query.normal_v, req.query.normalV);
  const caseVal = firstDefined(req.query.case_val, req.query.caseVal);
  const courtCode = firstDefined(req.query.court_code, req.query.courtCode);
  if (!req.query.sessionId) {
    return res.status(400).json({ success: false, error: MESSAGES.MISSING_SESSION_ID });
  }
  if (!normalV || !caseVal || !courtCode || !req.query.filename) {
    return res.status(400).json({ success: false, error: MESSAGES.MISSING_ORDER_PDF_QUERY });
  }
  return next();
}

module.exports = {
  validateCaseData,
  validateCaseDetail,
  validateIaBusiness,
  validateBusinessDetailPost,
  validateBusinessDetailGet,
  validateOrderPdfPost,
  validateOrderPdfGet,
};
