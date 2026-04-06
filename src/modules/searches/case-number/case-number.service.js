"use strict";

const { BASE_URL } = require("../../../config/ecourts");
const { postWithRetry, fetchCaptchaPayload } = require("../../portal/portal.service");
const {
  parseOptionPayload,
  serializeRawPayload,
} = require("../../../shared/parsers/option-list.parser");
const {
  normalizeCaseNumberSearchResponse,
  normalizeViewBusinessResponse,
  parseIABusinessHtml,
  parseCaseNumberResults,
  parseViewBusinessHtml,
} = require("./parsers");

function buildCaptchaFragment(captchaPayload) {
  if (!captchaPayload?.captcha) return "";
  return [
    '<div class="form-inline text-left">',
    "<div>",
    `<img id="captcha_image" src="${captchaPayload.captcha}" alt="Captcha" width="120" style="padding-right:0;border:1px solid #ccc;">`,
    "</div>",
    "</div>",
  ].join("");
}

function buildOptionResponse(options) {
  const normalized = options.map((item) => ({
    code: String(item.code || "").trim(),
    options: String(item.name || "").trim(),
  }));

  const name = {};
  normalized.forEach((item) => {
    if (item.code && item.options) {
      name[item.options] = item.code;
    }
  });

  return {
    list: normalized,
    name,
  };
}

async function fetchCaseTypes(
  session,
  {
    stateCode,
    distCode,
    courtComplexCode,
    estCode = "",
    searchType,
  },
) {
  const payload = await postWithRetry(session, "casestatus/fillCaseType", {
    state_code: stateCode,
    dist_code: distCode,
    court_complex_code: courtComplexCode,
    est_code: estCode,
    search_type: searchType,
  });

  const parsedOptions = parseOptionPayload(payload);
  return {
    options: buildOptionResponse(parsedOptions),
    rawHtml: serializeRawPayload(payload),
    raw: payload,
  };
}

/**
 * Layer 2 – fetch full case detail via viewHistory.
 * For case-number searches, both search_flag and search_by are "CScaseNumber".
 */
async function fetchViewHistory(session, params) {
  const data = await postWithRetry(session, "home/viewHistory", {
    court_code: params.courtCode,
    state_code: params.stateCode || session.stateCode,
    dist_code: params.distCode || session.distCode,
    court_complex_code: params.complexCode || session.complexCode,
    case_no: params.caseNo,
    cino: params.cino,
    hideparty: params.hideparty || "",
    search_flag: params.searchFlag || "CScaseNumber",
    search_by: params.searchBy || "CScaseNumber",
  });

  return typeof data === "string"
    ? data
    : data.data_list || JSON.stringify(data);
}

async function fetchIABusiness(session, iaParams, parentCino) {
  const data = await postWithRetry(session, "home/viewIABusiness", {
    state_code: session.stateCode,
    dist_code: session.distCode,
    court_complex_code: session.complexCode,
    ia_no: iaParams.ia_no,
    cinoia: iaParams.cinoia || parentCino,
    ia_case_type_name: iaParams.ia_case_type_name || "IA",
    ia_filno: iaParams.ia_filno,
    ia_filyear: iaParams.ia_filyear,
    national_court_code: iaParams.national_court_code,
    search_by: iaParams.search_by || "CScaseNumber",
  });

  const html = typeof data === "object" ? data.data_list : data;
  return {
    result: parseIABusinessHtml(html || ""),
    rawHtml: html || "",
    raw: data,
  };
}

async function fetchViewBusiness(session, bParams, cino) {
  const payload = {
    court_code: bParams.court_code || bParams.courtCode || "",
    state_code: bParams.state_code || bParams.stateCode || session.stateCode,
    dist_code: bParams.dist_code || bParams.distCode || session.distCode,
    court_complex_code:
      bParams.court_complex_code ||
      bParams.courtComplexCode ||
      session.complexCode,
    nextdate1: bParams.nextdate1,
    case_number1: bParams.case_number1 || bParams.caseNumber1 || cino,
    disposal_flag: bParams.disposal_flag || bParams.disposalFlag || "Pending",
    businessDate: bParams.businessDate,
    national_court_code:
      bParams.national_court_code || bParams.nationalCourtCode,
    court_no: bParams.court_no || bParams.courtNo,
    search_by: bParams.search_by || bParams.searchBy || "CScaseNumber",
    srno: bParams.srno,
  };

  const data = await postWithRetry(session, "home/viewBusiness", payload);
  const normalized = normalizeViewBusinessResponse(data);
  return {
    status: normalized.upstreamStatus ?? 1,
    data_list: normalized.html || "",
    rawHtml: normalized.html || "",
    parsed: parseViewBusinessHtml(normalized.html || ""),
    raw: normalized.raw,
    requestPayload: payload,
  };
}

async function fetchDisplayPdf(session, pdfParams) {
  const data = await postWithRetry(session, "home/display_pdf", {
    normal_v: pdfParams.normal_v,
    case_val: pdfParams.case_val,
    court_code: pdfParams.court_code,
    filename: pdfParams.filename,
    appFlag: pdfParams.appFlag || "",
  });
  const orderPath = typeof data === "object" ? data.order : null;
  return orderPath
    ? { pdf_url: `${BASE_URL}${orderPath}`, raw_path: orderPath }
    : { pdf_url: null, raw_path: null };
}

async function fetchDisplayPdfBinary(session, pdfParams) {
  const pdfMeta = await fetchDisplayPdf(session, pdfParams);
  if (!pdfMeta.pdf_url) {
    return { pdf_url: null, raw_path: null, contentType: null, data: null };
  }

  const resp = await session.client.get(pdfMeta.pdf_url, {
    responseType: "arraybuffer",
    headers: {
      Accept: "application/pdf,*/*",
      Referer:
        "https://services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/index",
    },
  });

  return {
    ...pdfMeta,
    contentType: resp.headers["content-type"] || "application/pdf",
    data: resp.data,
  };
}

function buildBusinessDetailQueryParams(query) {
  return {
    cino: query.cino || "",
    params: {
      court_code: query.court_code || query.courtCode || "",
      state_code: query.state_code || query.stateCode || "",
      dist_code: query.dist_code || query.distCode || "",
      court_complex_code:
        query.court_complex_code || query.courtComplexCode || "",
      nextdate1: query.nextdate1 || "",
      case_number1: query.case_number1 || query.caseNumber1 || "",
      disposal_flag: query.disposal_flag || query.disposalFlag || "",
      businessDate: query.businessDate || "",
      national_court_code:
        query.national_court_code || query.nationalCourtCode || "",
      court_no: query.court_no || query.courtNo || "",
      search_by: query.search_by || query.searchBy || "",
      srno: query.srno || "",
    },
  };
}

function buildCaseNumberSearchSuccessResponse({
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
  searchBy = "CScaseNumber",
}) {
  return {
    status: normalizedSearch.upstreamStatus ?? 1,
    message: "Valid case-number search result parsed from raw.case_data",
    result: {
      metadata: {
        totalEstablishments: metadata.totalEstablishments || 0,
        totalCases: metadata.totalCases || 0,
        courtName: metadata.courtName || "",
        searchBy: "caseNumber",
        searchType: searchBy,
        stateCode: String(resolvedState || ""),
        distCode: String(resolvedDist || ""),
        complexCode: String(resolvedComplex || ""),
      },
      courtBreakdown,
      parsedCases: cases,
      nextCaptcha,
      div_captcha: responseCaptchaFragment,
    },
    rawHtml: layer1Html,
  };
}

module.exports = {
  fetchCaptchaPayload,
  buildCaptchaFragment,
  fetchCaseTypes,
  postWithRetry,
  fetchViewHistory,
  fetchIABusiness,
  fetchViewBusiness,
  fetchDisplayPdf,
  fetchDisplayPdfBinary,
  buildBusinessDetailQueryParams,
  buildCaseNumberSearchSuccessResponse,
  normalizeCaseNumberSearchResponse,
  parseCaseNumberResults,
};
