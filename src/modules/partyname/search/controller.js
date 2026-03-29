"use strict";

const {
  coerceBoolean,
  firstDefined,
  sendJsonSuccess,
} = require("./utils/common");
const { buildBusinessDetailPdfBuffer } = require("./utils/pdf");
const { MESSAGES } = require("./constants");
const {
  buildBusinessDetailQueryParams,
  buildCaptchaFragment,
  buildPartySearchSuccessResponse,
  fetchCaptchaPayload,
  fetchDisplayPdf,
  fetchDisplayPdfBinary,
  fetchIABusiness,
  fetchViewBusiness,
  fetchViewHistory,
  normalizePartySearchResponse,
  parsePartyNameResults,
  postWithRetry,
} = require("./service");
const { parseCaseDetail } = require("./parsers");
const { getSession } = require("./store/sessionStore");

async function caseData(req, res) {
  const { sessionId, rgyearP, stateCode, distCode, estCode } = req.body;
  const petresName = firstDefined(req.body.petresName, req.body.petres_name);
  const caseStatus = firstDefined(req.body.caseStatus, req.body.case_status, "Pending");
  const captchaCode = firstDefined(req.body.captchaCode, req.body.fcaptcha_code);
  const courtComplexCode = firstDefined(
    req.body.courtComplexCode,
    req.body.court_complex_code,
  );
  const fetchDetails = coerceBoolean(req.body.fetchDetails, false);
  const fetchIABusinessFlag = coerceBoolean(req.body.fetchIABusiness, false);
  const fetchBusinessFlag = coerceBoolean(req.body.fetchBusiness, false);
  const fetchPdf = coerceBoolean(req.body.fetchPdf, false);

  if (!sessionId || !petresName || !captchaCode) {
    return res.status(400).json({
      success: false,
      status: 0,
      error: MESSAGES.MISSING_CASE_DATA_FIELDS,
    });
  }

  try {
    const session = getSession(sessionId);
    const resolvedState = stateCode || session.stateCode;
    const resolvedDist = distCode || session.distCode;
    const resolvedComplex = courtComplexCode || session.complexCode;
    const resolvedEst = estCode || session.estCode || "null";

    if (!resolvedState || !resolvedDist || !resolvedComplex) {
      return res.status(400).json({
        success: false,
        status: 0,
        error: MESSAGES.COURT_DETAILS_NOT_SET,
      });
    }

    let layer1Data;
    try {
      layer1Data = await postWithRetry(session, "casestatus/submitPartyName", {
        petres_name: petresName,
        rgyearP: rgyearP || "",
        case_status: caseStatus || "Pending",
        fcaptcha_code: captchaCode,
        state_code: resolvedState,
        dist_code: resolvedDist,
        court_complex_code: resolvedComplex,
        est_code: resolvedEst,
      });
    } catch (err) {
      let nextCaptcha = null;
      try {
        nextCaptcha = await fetchCaptchaPayload(session, { warm: true });
      } catch (_captchaErr) {
        nextCaptcha = null;
      }
      const statusCode = err.message === "Invalid CAPTCHA" ? 422 : 500;
      return res.status(statusCode).json({
        success: false,
        status: 0,
        error: err.message,
        nextCaptcha,
      });
    }

    const normalizedSearch = normalizePartySearchResponse(layer1Data);
    const layer1Html =
      normalizedSearch.html ||
      (typeof normalizedSearch.raw?.party_data === "string"
        ? normalizedSearch.raw.party_data
        : "");

    let nextCaptcha = null;
    try {
      nextCaptcha = await fetchCaptchaPayload(session, { warm: true });
    } catch (_captchaErr) {
      nextCaptcha = null;
    }

    const responseCaptchaFragment =
      normalizedSearch.divCaptcha || buildCaptchaFragment(nextCaptcha);

    if (!layer1Html && normalizedSearch.upstreamStatus !== 1) {
      return res.status(422).json({
        success: false,
        status: 0,
        error: MESSAGES.EMPTY_SEARCH_RESPONSE,
        nextCaptcha,
      });
    }

    if (!layer1Html) {
      return res.status(422).json({
        success: false,
        status: 0,
        error: MESSAGES.EMPTY_PARTY_DATA_RESPONSE,
        nextCaptcha,
      });
    }

    const { cases, metadata, courtBreakdown } = parsePartyNameResults(layer1Html);

    if (!fetchDetails) {
      return sendJsonSuccess(
        res,
        buildPartySearchSuccessResponse({
          normalizedSearch,
          layer1Html,
          responseCaptchaFragment,
          nextCaptcha,
          cases,
          metadata,
          courtBreakdown,
          resolvedState,
          resolvedDist,
          resolvedComplex,
        }),
      );
    }

    const enrichedCases = [];
    for (const c of cases) {
      const vd = c.viewDetails;
      if (!vd || !vd.caseNo) {
        enrichedCases.push(c);
        continue;
      }

      let caseDetail = {};
      try {
        const detailHtml = await fetchViewHistory(session, {
          caseNo: vd.caseNo,
          cino: vd.cino,
          courtCode: vd.courtCode,
          hideparty: vd.hideparty,
          searchFlag: vd.searchFlag,
          stateCode: vd.stateCode || resolvedState,
          distCode: vd.distCode || resolvedDist,
          complexCode: vd.complexCode || resolvedComplex,
          searchBy: vd.searchBy || "CSpartyName",
        });
        caseDetail = parseCaseDetail(detailHtml);

        if (fetchIABusinessFlag && caseDetail.ia_status?.length) {
          for (const ia of caseDetail.ia_status) {
            if (ia.ia_params?.ia_no) {
              try {
                const iaBusinessResponse = await fetchIABusiness(
                  session,
                  ia.ia_params,
                  vd.cino,
                );
                ia.ia_business = iaBusinessResponse.result;
                ia.ia_business_rawHtml = iaBusinessResponse.rawHtml;
              } catch (e) {
                ia.ia_business = { error: e.message };
              }
            }
          }
        }

        if (fetchBusinessFlag && caseDetail.history_of_case_hearing) {
          for (const h of caseDetail.history_of_case_hearing) {
            if (h.business_params?.businessDate) {
              try {
                h.business_detail = await fetchViewBusiness(
                  session,
                  h.business_params,
                  vd.cino,
                );
              } catch (e) {
                h.business_detail = { error: e.message };
              }
            }
          }
        }

        if (fetchPdf && caseDetail.interim_orders) {
          for (const o of caseDetail.interim_orders) {
            if (o.pdf_params?.normal_v) {
              try {
                o.pdf = await fetchDisplayPdf(session, o.pdf_params);
              } catch (e) {
                o.pdf = { error: e.message };
              }
            }
          }
        }
      } catch (e) {
        caseDetail = { error: `Failed to fetch details: ${e.message}` };
      }

      enrichedCases.push({ ...c, details: caseDetail });
    }

    const payload = buildPartySearchSuccessResponse({
      normalizedSearch,
      layer1Html,
      responseCaptchaFragment,
      nextCaptcha,
      cases: enrichedCases,
      metadata,
      courtBreakdown,
      resolvedState,
      resolvedDist,
      resolvedComplex,
    });
    payload.result.parsedCases = enrichedCases;
    return sendJsonSuccess(res, payload);
  } catch (err) {
    return res.status(500).json({ success: false, status: 0, error: err.message });
  }
}

async function caseDetail(req, res) {
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ success: false, error: MESSAGES.MISSING_SESSION_ID });

  try {
    const session = getSession(sessionId);
    const params = {
      caseNo: firstDefined(req.body.caseNo, req.body.case_no),
      cino: req.body.cino || "",
      courtCode: firstDefined(req.body.courtCode, req.body.court_code),
      hideparty: firstDefined(req.body.hideparty, ""),
      searchFlag: firstDefined(req.body.searchFlag, req.body.search_flag, "CScaseNumber"),
      stateCode: firstDefined(req.body.stateCode, req.body.state_code),
      distCode: firstDefined(req.body.distCode, req.body.dist_code),
      complexCode: firstDefined(
        req.body.complexCode,
        req.body.complex_code,
        req.body.court_complex_code,
      ),
      searchBy: firstDefined(req.body.searchBy, req.body.search_by, "CSpartyName"),
    };

    if (!params.caseNo || !params.cino || !params.courtCode) {
      return res.status(400).json({
        success: false,
        error: MESSAGES.MISSING_CASE_DETAIL_FIELDS,
      });
    }

    const html = await fetchViewHistory(session, params);
    return sendJsonSuccess(res, {
      message: MESSAGES.CASE_DETAIL_FETCHED,
      result: parseCaseDetail(html),
      rawHtml: html,
      extra: {
        requestPayload: {
          court_code: params.courtCode,
          state_code: params.stateCode || session.stateCode,
          dist_code: params.distCode || session.distCode,
          court_complex_code: params.complexCode || session.complexCode,
          case_no: params.caseNo,
          cino: params.cino,
          hideparty: params.hideparty || "",
          search_flag: params.searchFlag || "CScaseNumber",
          search_by: params.searchBy || "CSpartyName",
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function iaBusiness(req, res) {
  const { sessionId, ...iaParams } = req.body;
  if (!sessionId) return res.status(400).json({ success: false, error: MESSAGES.MISSING_SESSION_ID });

  try {
    const session = getSession(sessionId);
    const iaResponse = await fetchIABusiness(session, iaParams, iaParams.cinoia);
    return sendJsonSuccess(res, {
      message: MESSAGES.IA_BUSINESS_FETCHED,
      result: iaResponse.result,
      rawHtml: iaResponse.rawHtml,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function businessDetailPost(req, res) {
  const { sessionId, cino, ...bParams } = req.body;
  if (!sessionId) return res.status(400).json({ success: false, error: MESSAGES.MISSING_SESSION_ID });

  try {
    const session = getSession(sessionId);
    const result = await fetchViewBusiness(session, bParams, cino);
    if (!result.data_list && result.status !== 1) {
      return res.status(422).json({
        success: false,
        status: 0,
        error: MESSAGES.EMPTY_VIEW_BUSINESS_RESPONSE,
      });
    }

    return sendJsonSuccess(res, {
      status: result.status,
      message: MESSAGES.BUSINESS_DETAIL_FETCHED,
      result: result.parsed,
      rawHtml: result.rawHtml,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function businessDetailGet(req, res) {
  const { sessionId } = req.query;
  if (!sessionId) return res.status(400).json({ success: false, error: MESSAGES.MISSING_SESSION_ID });

  try {
    const { cino, params } = buildBusinessDetailQueryParams(req.query);
    const session = getSession(sessionId);
    const result = await fetchViewBusiness(session, params, cino);
    if (!result.data_list && result.status !== 1) {
      return res.status(422).json({
        success: false,
        status: 0,
        error: MESSAGES.EMPTY_VIEW_BUSINESS_RESPONSE,
      });
    }

    const format = String(req.query.format || "json").toLowerCase();
    if (format === "pdf") {
      const pdfBuffer = await buildBusinessDetailPdfBuffer(result.parsed || {});
      const safeName = `${(result.parsed?.case_number || "business-detail")
        .replace(/[^\w.-]+/g, "_")}.pdf`;
      const download = String(req.query.download || "true").toLowerCase() !== "false";
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `${download ? "attachment" : "inline"}; filename="${safeName}"`,
      );
      return res.send(pdfBuffer);
    }

    return sendJsonSuccess(res, {
      status: result.status,
      message: MESSAGES.BUSINESS_DETAIL_FETCHED,
      result: result.parsed,
      rawHtml: result.rawHtml,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function businessDetailPrint(req, res) {
  const { sessionId, cino } = req.query;
  if (!sessionId) return res.status(400).json({ success: false, error: MESSAGES.MISSING_SESSION_ID });

  try {
    const { params } = buildBusinessDetailQueryParams(req.query);
    const session = getSession(sessionId);
    const result = await fetchViewBusiness(session, params, cino);
    if (!result.data_list && result.status !== 1) {
      return res.status(422).json({
        success: false,
        status: 0,
        error: MESSAGES.EMPTY_VIEW_BUSINESS_RESPONSE,
      });
    }

    const pdfBuffer = await buildBusinessDetailPdfBuffer(result.parsed || {});
    const fileName = `${(result.parsed?.case_number || "business-detail")
      .replace(/[^\w.-]+/g, "_")}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    return res.send(pdfBuffer);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function orderPdfPost(req, res) {
  const { sessionId, ...pdfParams } = req.body;
  if (!sessionId) return res.status(400).json({ success: false, error: MESSAGES.MISSING_SESSION_ID });

  try {
    const session = getSession(sessionId);
    const result = await fetchDisplayPdf(session, pdfParams);
    return sendJsonSuccess(res, {
      message: MESSAGES.ORDER_PDF_METADATA_FETCHED,
      result,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function orderPdfGet(req, res) {
  const { sessionId } = req.query;
  if (!sessionId) {
    return res.status(400).json({ success: false, error: MESSAGES.MISSING_SESSION_ID });
  }

  const pdfParams = {
    normal_v: firstDefined(req.query.normal_v, req.query.normalV),
    case_val: firstDefined(req.query.case_val, req.query.caseVal),
    court_code: firstDefined(req.query.court_code, req.query.courtCode),
    filename: req.query.filename || "",
    appFlag: firstDefined(req.query.appFlag, req.query.app_flag, ""),
  };

  if (!pdfParams.normal_v || !pdfParams.case_val || !pdfParams.court_code || !pdfParams.filename) {
    return res.status(400).json({
      success: false,
      error: MESSAGES.MISSING_ORDER_PDF_QUERY,
    });
  }

  try {
    const session = getSession(sessionId);
    const pdfResult = await fetchDisplayPdfBinary(session, pdfParams);
    if (!pdfResult.data || !pdfResult.pdf_url) {
      return res.status(404).json({
        success: false,
        error: MESSAGES.PDF_NOT_AVAILABLE,
      });
    }

    const safeFileName = pdfParams.filename.toString().split("/").pop() || "order.pdf";
    res.setHeader("Content-Type", pdfResult.contentType || "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${safeFileName}"`);
    return res.send(Buffer.from(pdfResult.data));
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = {
  caseData,
  caseDetail,
  iaBusiness,
  businessDetailPost,
  businessDetailGet,
  businessDetailPrint,
  orderPdfPost,
  orderPdfGet,
};
