"use strict";

const MESSAGES = {
  SESSION_INITIALIZED: "Session initialized successfully",
  COURT_DETAILS_SET: "Court details set successfully",
  CAPTCHA_FETCHED: "Captcha fetched successfully",
  CASE_SEARCH_FETCHED: "Valid party-name search result parsed from raw.party_data",
  CASE_DETAIL_FETCHED: "Case details fetched successfully",
  IA_BUSINESS_FETCHED: "IA business fetched successfully",
  BUSINESS_DETAIL_FETCHED: "Business details fetched successfully",
  ORDER_PDF_METADATA_FETCHED: "Order PDF metadata fetched successfully",
  MISSING_REQUIRED_FIELDS: "Missing required fields",
  MISSING_SESSION_ID: "Missing sessionId",
  MISSING_CASE_DETAIL_FIELDS:
    "Missing required fields: caseNo/case_no, cino, courtCode/court_code",
  MISSING_CASE_DATA_FIELDS:
    "Missing required fields: sessionId, petresName/petres_name, captchaCode/fcaptcha_code",
  COURT_DETAILS_NOT_SET:
    "Court details not set. Call /api/partyname/court-details first.",
  EMPTY_SEARCH_RESPONSE:
    "Empty response from eCourts. Captcha may be wrong or session expired.",
  EMPTY_PARTY_DATA_RESPONSE:
    "Search completed but no parsable party_data HTML was returned.",
  EMPTY_VIEW_BUSINESS_RESPONSE:
    "Empty response from eCourts for viewBusiness. Session may be stale or the business row may no longer be available.",
  PDF_NOT_AVAILABLE:
    "PDF not available for the provided order parameters.",
  MISSING_ORDER_PDF_QUERY:
    "Missing required query params: normal_v, case_val, court_code, filename",
};

module.exports = {
  MESSAGES,
};
