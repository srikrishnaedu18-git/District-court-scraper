"use strict";

const { DEFAULT_HEADERS } = require("../../config/ecourts");
const { buildForm, sleep } = require("./utils/common");

async function initSession(session) {
  const resp = await session.client.get("", {
    params: { p: "casestatus/index", app_token: "" },
    headers: { Accept: "text/html,application/xhtml+xml" },
  });

  if (typeof resp.data === "string") {
    const match = resp.data.match(/app_token['":\s]+([a-zA-Z0-9+/=_-]{20,})/);
    if (match) session.appToken = match[1];
  }

  return session;
}

async function postWithRetry(session, path, fields, retries = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const body = buildForm(fields, session.appToken);
      const resp = await session.client.post("", body, {
        params: { p: path },
        headers: {
          Referer:
            "https://services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/index",
        },
      });

      const data = resp.data;
      if (
        typeof data === "string" &&
        /session.*expired|expired.*session/i.test(data)
      ) {
        throw new Error("Session expired");
      }
      if (
        typeof data === "string" &&
        /invalid.*captcha|captcha.*invalid|wrong.*captcha/i.test(data)
      ) {
        throw new Error("Invalid CAPTCHA");
      }
      return data;
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        if (err.message === "Invalid CAPTCHA") throw err;
        await sleep(500 * attempt);
      }
    }
  }
  throw lastErr;
}

async function setCourtDetails(session, { complexCode, stateCode, distCode, estCode = "null" }) {
  const data = await postWithRetry(session, "casestatus/set_data", {
    p: "casestatus/set_data",
    complex_code: complexCode,
    selected_state_code: stateCode,
    selected_dist_code: distCode,
    selected_est_code: estCode,
  });

  session.complexCode =
    typeof data === "object" && data.complex_code
      ? data.complex_code
      : complexCode.split("@")[0];
  session.stateCode = stateCode;
  session.distCode = distCode;
  session.estCode =
    typeof data === "object" ? data.est_code || estCode : estCode;

  return data;
}

async function fetchCaptchaPayload(session, { warm = true } = {}) {
  if (warm) {
    await session.client.get("", {
      params: { p: "casestatus/index" },
      headers: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": DEFAULT_HEADERS["User-Agent"],
      },
    });
  }

  const getCaptchaBody = buildForm({}, session.appToken);
  await session.client.post("", getCaptchaBody, {
    params: { p: "casestatus/getCaptcha" },
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "X-Requested-With": "XMLHttpRequest",
      Accept: "application/json, text/javascript, */*; q=0.01",
      Referer:
        "https://services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/index",
      Origin: "https://services.ecourts.gov.in",
    },
  });

  const captchaResp = await session.client.get(
    "vendor/securimage/securimage_show.php",
    {
      params: { t: Date.now() },
      responseType: "arraybuffer",
      headers: {
        Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
        Referer:
          "https://services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/index",
      },
    },
  );

  const contentType = captchaResp.headers["content-type"] || "image/png";
  const base64 = Buffer.from(captchaResp.data).toString("base64");
  return {
    captcha: `data:${contentType};base64,${base64}`,
    contentType,
  };
}

async function fetchDistricts(session, stateCode) {
  const html = await postWithRetry(session, "casestatus/fillDistrict", {
    state_code: stateCode,
  });
  return typeof html === "string" ? html : String(html || "");
}

async function fetchCourts(session, { stateCode, distCode }) {
  const html = await postWithRetry(session, "casestatus/fillcomplex", {
    state_code: stateCode,
    dist_code: distCode,
  });
  return typeof html === "string" ? html : String(html || "");
}

module.exports = {
  initSession,
  postWithRetry,
  setCourtDetails,
  fetchCaptchaPayload,
  fetchDistricts,
  fetchCourts,
};
