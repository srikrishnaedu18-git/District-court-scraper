"use strict";

const { buildForm, firstDefined, sendJsonSuccess } = require("../../shared/utils/common.util");
const { COMMON_MESSAGES } = require("./portal.constants");
const { parseOptionList } = require("../../shared/parsers/option-list.parser");
const {
  fetchCaptchaPayload,
  fetchCourts,
  fetchDistricts,
  fetchEstablishments,
  initSession,
  setCourtDetails,
} = require("./portal.service");
const { createSession, getSession } = require("../../shared/store/sessionStore");

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

async function courtDetails(req, res) {
  const sessionId = req.body.sessionId;
  const complexCode = firstDefined(req.body.complexCode, req.body.complex_code);
  const stateCode = firstDefined(req.body.stateCode, req.body.state_code);
  const distCode = firstDefined(req.body.distCode, req.body.dist_code);
  const estCode = firstDefined(req.body.estCode, req.body.est_code, "null");

  try {
    const session = getSession(sessionId);
    const data = await setCourtDetails(session, {
      complexCode,
      stateCode,
      distCode,
      estCode,
    });
    return sendJsonSuccess(res, {
      message: COMMON_MESSAGES.COURT_DETAILS_SET,
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
    const rawHtml = await fetchDistricts(session, stateCode);
    return sendJsonSuccess(res, {
      message: COMMON_MESSAGES.DISTRICTS_FETCHED,
      result: {
        state_code: String(stateCode),
        districts: parseOptionList(rawHtml),
      },
      rawHtml,
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
    const rawHtml = await fetchCourts(session, { stateCode, distCode });
    return sendJsonSuccess(res, {
      message: COMMON_MESSAGES.COURTS_FETCHED,
      result: {
        state_code: String(stateCode),
        dist_code: String(distCode),
        courts: parseOptionList(rawHtml),
      },
      rawHtml,
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
    const rawHtml = await fetchEstablishments(session, {
      stateCode,
      distCode,
      courtComplexCode,
    });
    return sendJsonSuccess(res, {
      message: COMMON_MESSAGES.ESTABLISHMENTS_FETCHED,
      result: {
        state_code: String(stateCode),
        dist_code: String(distCode),
        court_complex_code: String(courtComplexCode),
        establishments: parseOptionList(rawHtml),
      },
      rawHtml,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  init,
  courtDetails,
  captcha,
  captchaDebug,
  captchaImage,
  districts,
  courts,
  establishments,
};
