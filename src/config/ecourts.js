"use strict";

const BASE_URL = "https://services.ecourts.gov.in/ecourtindia_v6/";

const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/html, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
  "X-Requested-With": "XMLHttpRequest",
  Origin: "https://services.ecourts.gov.in",
  Referer: "https://services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/index",
};

module.exports = {
  BASE_URL,
  DEFAULT_HEADERS,
};
