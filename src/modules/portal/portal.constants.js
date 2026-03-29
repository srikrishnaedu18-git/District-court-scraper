"use strict";

const COMMON_MESSAGES = {
  SESSION_INITIALIZED: "Session initialized successfully",
  FIELDS_SET: "Fields set successfully",
  CAPTCHA_FETCHED: "Captcha fetched successfully",
  DISTRICTS_FETCHED: "Districts fetched successfully",
  COURTS_FETCHED: "Courts fetched successfully",
  ESTABLISHMENTS_FETCHED: "Establishments fetched successfully",
  MISSING_SESSION_ID: "Missing sessionId",
  MISSING_REQUIRED_FIELDS: "Missing required fields",
  MISSING_STATE_CODE: "Missing required field: stateCode/state_code",
  MISSING_DISTRICT_FIELDS: "Missing required fields: stateCode/state_code, distCode/dist_code",
  MISSING_ESTABLISHMENT_FIELDS:
    "Missing required fields: stateCode/state_code, distCode/dist_code, courtComplexCode/court_complex_code",
  MISSING_SET_FIELDS:
    "Missing required fields: sessionId, complexCode/complex_code, stateCode/state_code, distCode/dist_code",
};

module.exports = {
  COMMON_MESSAGES,
};
