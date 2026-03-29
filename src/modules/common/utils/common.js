"use strict";

function buildForm(fields, appToken = "") {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(fields)) {
    params.append(key, value ?? "");
  }
  params.append("ajax_req", "true");
  params.append("app_token", appToken);
  return params.toString();
}

function firstDefined(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return "";
}

function coerceBoolean(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
  }
  return Boolean(value);
}

function sendJsonSuccess(
  res,
  { status = 1, message = "Success", result = {}, rawHtml = null, extra = {} },
) {
  return res.json({
    success: true,
    status,
    message,
    result,
    rawHtml,
    ...extra,
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  buildForm,
  firstDefined,
  coerceBoolean,
  sendJsonSuccess,
  sleep,
};
