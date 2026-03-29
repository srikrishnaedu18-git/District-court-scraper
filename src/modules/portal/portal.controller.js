"use strict";

const { buildForm, firstDefined, sendJsonSuccess } = require("../../shared/utils/common.util");
const { COMMON_MESSAGES } = require("./portal.constants");
const {
  parseOptionPayload,
  serializeRawPayload,
} = require("../../shared/parsers/option-list.parser");
const {
  fetchCaptchaPayload,
  fetchCourts,
  fetchDistricts,
  fetchEstablishments,
  initSession,
  setCourtDetails,
} = require("./portal.service");
const { createSession, getSession } = require("../../shared/store/sessionStore");

function buildOptionResponse(options) {
  const normalized = options.map((item) => {
    const rawCode = String(item.code || "").trim();
    const hasComplexNumber = rawCode.includes("@");
    const complexParts = hasComplexNumber ? rawCode.split("@") : [];
    const trimmedCode = hasComplexNumber ? complexParts[0] : rawCode;
    const normalizedItem = {
      code: trimmedCode,
      options: item.name,
    };
    if (hasComplexNumber) {
      normalizedItem.complex_number = rawCode;
      if (complexParts[1]) {
        normalizedItem.court_codes = String(complexParts[1])
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
      }
      if (complexParts[2]) {
        normalizedItem.differ_mast_est = String(complexParts[2]).trim();
      }
    }
    return normalizedItem;
  });

  const name = {};
  normalized.forEach((item) => {
    if (item.options && item.code) {
      name[item.options] = item.code;
    }
  });

  return {
    list: normalized,
    name,
  };
}

async function init(_req, res) {
  try {
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const session = getSession(sessionId);
    await initSession(session);
    return sendJsonSuccess(res, {
      message: COMMON_MESSAGES.SESSION_INITIALIZED,
      result: { sessionId },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function setFields(req, res) {
  const sessionId = req.body.sessionId;
  const complexCode = firstDefined(
    req.body.complexCode,
    req.body.complex_code,
    req.body.complex_number,
  );
  const stateCode = firstDefined(req.body.stateCode, req.body.state_code);
  const distCode = firstDefined(req.body.distCode, req.body.dist_code);
  const estCode = firstDefined(req.body.estCode, req.body.est_code);

  try {
    const session = getSession(sessionId);
    const data = await setCourtDetails(session, {
      complexCode,
      stateCode,
      distCode,
      estCode,
    });
    return sendJsonSuccess(res, {
      message: COMMON_MESSAGES.FIELDS_SET,
      result: data,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function captcha(req, res) {
  const { sessionId } = req.query;

  try {
    const session = getSession(sessionId);
    const { captcha: captchaImage, contentType } = await fetchCaptchaPayload(session, {
      warm: true,
    });
    return sendJsonSuccess(res, {
      message: COMMON_MESSAGES.CAPTCHA_FETCHED,
      result: { captcha: captchaImage, contentType },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function captchaDebug(_req, res) {
  try {
    const session = createSession();
    await session.client.get("", { params: { p: "casestatus/index" } });
    await session.client.post("", "ajax_req=true&app_token=", {
      params: { p: "casestatus/getCaptcha" },
    });
    const resp = await session.client.get(
      "vendor/securimage/securimage_show.php",
      {
        params: { t: Date.now() },
        responseType: "stream",
      },
    );
    res.setHeader("Content-Type", resp.headers["content-type"] || "image/png");
    return resp.data.pipe(res);
  } catch (err) {
    return res.status(500).send(err.message);
  }
}

async function captchaImage(req, res) {
  const { sessionId } = req.query;

  try {
    const session = getSession(sessionId);
    await session.client.get("", { params: { p: "casestatus/index" } });
    const getCaptchaBody = buildForm({}, session.appToken);
    await session.client.post("", getCaptchaBody, {
      params: { p: "casestatus/getCaptcha" },
    });
    const captchaResp = await session.client.get(
      "vendor/securimage/securimage_show.php",
      {
        params: { t: Date.now() },
        responseType: "stream",
      },
    );
    res.setHeader("Content-Type", captchaResp.headers["content-type"] || "image/png");
    return captchaResp.data.pipe(res);
  } catch (err) {
    return res.status(500).send(err.message);
  }
}

async function districts(req, res) {
  const sessionId = firstDefined(req.body.sessionId, req.query.sessionId);
  const stateCode = firstDefined(
    req.body.stateCode,
    req.body.state_code,
    req.query.stateCode,
    req.query.state_code,
  );

  try {
    const session = getSession(sessionId);
    const payload = await fetchDistricts(session, stateCode);
    const parsedOptions = parseOptionPayload(payload);
    const optionResponse = buildOptionResponse(parsedOptions);
    return sendJsonSuccess(res, {
      message: COMMON_MESSAGES.DISTRICTS_FETCHED,
      result: {
        state_code: String(stateCode),
        districts: optionResponse.list,
        name: optionResponse.name,
      },
      rawHtml: serializeRawPayload(payload),
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function courts(req, res) {
  const sessionId = firstDefined(req.body.sessionId, req.query.sessionId);
  const stateCode = firstDefined(
    req.body.stateCode,
    req.body.state_code,
    req.query.stateCode,
    req.query.state_code,
  );
  const distCode = firstDefined(
    req.body.distCode,
    req.body.dist_code,
    req.query.distCode,
    req.query.dist_code,
  );

  try {
    const session = getSession(sessionId);
    const payload = await fetchCourts(session, { stateCode, distCode });
    const parsedOptions = parseOptionPayload(payload);
    const optionResponse = buildOptionResponse(parsedOptions);
    return sendJsonSuccess(res, {
      message: COMMON_MESSAGES.COURTS_FETCHED,
      result: {
        state_code: String(stateCode),
        dist_code: String(distCode),
        courts: optionResponse.list,
        name: optionResponse.name,
      },
      rawHtml: serializeRawPayload(payload),
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function establishments(req, res) {
  const sessionId = firstDefined(req.body.sessionId, req.query.sessionId);
  const stateCode = firstDefined(
    req.body.stateCode,
    req.body.state_code,
    req.query.stateCode,
    req.query.state_code,
  );
  const distCode = firstDefined(
    req.body.distCode,
    req.body.dist_code,
    req.query.distCode,
    req.query.dist_code,
  );
  const courtComplexCode = firstDefined(
    req.body.courtComplexCode,
    req.body.court_complex_code,
    req.query.courtComplexCode,
    req.query.court_complex_code,
  );

  try {
    const session = getSession(sessionId);
    const payload = await fetchEstablishments(session, {
      stateCode,
      distCode,
      courtComplexCode,
    });
    const parsedOptions = parseOptionPayload(payload);
    const optionResponse = buildOptionResponse(parsedOptions);
    return sendJsonSuccess(res, {
      message: COMMON_MESSAGES.ESTABLISHMENTS_FETCHED,
      result: {
        state_code: String(stateCode),
        dist_code: String(distCode),
        court_complex_code: String(courtComplexCode),
        establishments: optionResponse.list,
        name: optionResponse.name,
      },
      rawHtml: serializeRawPayload(payload),
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  init,
  setFields,
  captcha,
  captchaDebug,
  captchaImage,
  districts,
  courts,
  establishments,
};
