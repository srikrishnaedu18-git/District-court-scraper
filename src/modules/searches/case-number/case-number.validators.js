"use strict";

const { firstDefined } = require("./utils/common");
const { MESSAGES } = require("./case-number.constants");

function validateCaseTypes(req, res, next) {
  const stateCode = firstDefined(req.body.stateCode, req.body.state_code);
  const distCode = firstDefined(req.body.distCode, req.body.dist_code);
  const courtComplexCode = firstDefined(
    req.body.courtComplexCode,
    req.body.court_complex_code,
  );
  const searchType = firstDefined(req.body.searchType, req.body.search_type);

  if (!req.body.sessionId || !stateCode || !distCode || !courtComplexCode || !searchType) {
    return res.status(400).json({
      success: false,
      status: 0,
      error: MESSAGES.MISSING_CASE_TYPES_FIELDS,
    });
  }
  return next();
}

/**
 * Validates Layer 1 case-data request.
 * Required: sessionId, caseType (case_type), searchCaseNo (search_case_no),
 *           rgyear, captchaCode (case_captcha_code)
 */
function validateCaseData(req, res, next) {
  const caseType = firstDefined(req.body.caseType, req.body.case_type);
  const searchCaseNo = firstDefined(req.body.searchCaseNo, req.body.search_case_no);
  const rgyear = firstDefined(req.body.rgyear);
  const captchaCode = firstDefined(req.body.captchaCode, req.body.case_captcha_code);

  if (!req.body.sessionId || !caseType || !searchCaseNo || !rgyear || !captchaCode) {
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
  validateCaseTypes,
  validateCaseData,
  validateCaseDetail,
  validateIaBusiness,
  validateBusinessDetailPost,
  validateOrderPdfPost,
  validateOrderPdfGet,
};
