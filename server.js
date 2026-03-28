/**
 * server.js — Jurident eCourts Scraping API
 * Party Name Search Flow
 *
 * Flow:
 *   1. POST /api/partyname/court-details  → set_data (lock in court complex)
 *   2. GET  /api/partyname/captcha        → fetch captcha image + session cookies
 *   3. POST /api/partyname/case-data      → submitPartyName (layer 1 – case list)
 *      └─ auto-fetches viewHistory        → (layer 2 – full case detail) for each case
 *         └─ auto-fetches viewIABusiness  → (layer 3.1 – IA business) for each IA row
 *         └─ auto-fetches viewBusiness    → (layer 3.2 – business on date) for each hearing row
 *         └─ auto-fetches display_pdf     → (layer 3.3 – order PDF path) for each order row
 */

"use strict";

require("dotenv").config();

const express = require("express");
const axios = require("axios");
const { wrapper } = require("axios-cookiejar-support");
const { CookieJar } = require("tough-cookie");
const cheerio = require("cheerio");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Constants ──────────────────────────────────────────────────────────────

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

// ─── Session Store (in-memory, keyed by sessionId) ──────────────────────────
// Each entry: { jar, client, appToken, complexCode, stateCode, distCode, estCode }

const sessions = new Map();

function createSession() {
  const jar = new CookieJar();
  const client = wrapper(
    axios.create({
      jar,
      withCredentials: true,
      baseURL: BASE_URL,
      timeout: 30000,
      headers: DEFAULT_HEADERS,
    }),
  );
  return {
    jar,
    client,
    appToken: "",
    complexCode: "",
    stateCode: "",
    distCode: "",
    estCode: "",
  };
}

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, createSession());
  }
  return sessions.get(sessionId);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Build URL-encoded form body from a plain object.
 * Always appends ajax_req=true and app_token from session.
 */
function buildForm(fields, appToken = "") {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(fields)) {
    params.append(k, v ?? "");
  }
  params.append("ajax_req", "true");
  params.append("app_token", appToken);
  return params.toString();
}

/**
 * POST to eCourts with robust retry on session expiry.
 * Retries up to `retries` times, refreshing cookies each time.
 */
async function postWithRetry(session, path, fields, retries = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const body = buildForm(fields, session.appToken);
      const resp = await session.client.post("", body, {
        params: { p: path },
        headers: {
          Referer:
            "https://services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/index",
        },
      });
      // If eCourts returns a session-expired HTML page (no JSON), treat as error
      if (
        typeof resp.data === "string" &&
        resp.data.includes("session") &&
        resp.data.includes("expired")
      ) {
        throw new Error("Session expired");
      }
      return resp.data;
    } catch (err) {
      lastErr = err;
      console.warn(`[attempt ${attempt}] ${path} failed: ${err.message}`);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
    }
  }
  throw lastErr;
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

function normalizePartySearchResponse(payload) {
  if (typeof payload === "string") {
    return {
      html: payload,
      raw: payload,
      upstreamStatus: null,
      divCaptcha: "",
    };
  }

  if (!payload || typeof payload !== "object") {
    return {
      html: "",
      raw: payload,
      upstreamStatus: null,
      divCaptcha: "",
    };
  }

  return {
    html: payload.party_data || payload.data_list || "",
    raw: payload,
    upstreamStatus:
      payload.status !== undefined && payload.status !== null
        ? Number(payload.status)
        : null,
    divCaptcha: payload.div_captcha || "",
  };
}

// ─── HTML Parsers ────────────────────────────────────────────────────────────

/**
 * Parse the party-name search results table (layer 1).
 * Returns { cases, metadata }
 */
function parsePartyNameResults(html) {
  const $ = cheerio.load(html);
  const groupedCases = [];
  const courtBreakdown = [];

  let totalEstablishments = 0;
  let totalCases = 0;
  let courtName = "";

  $(".courtsDiv, .col.border-top").each((_, el) => {
    const text = $(el).text();
    const estMatch = text.match(/Establishments[^:]*:\s*(\d+)/i);
    const casesMatch = text.match(/cases\s*:\s*(\d+)/i);
    if (estMatch) totalEstablishments = parseInt(estMatch[1], 10);
    if (casesMatch) totalCases = parseInt(casesMatch[1], 10);
  });

  const courtAnchor = $("a.noToken").first();
  if (courtAnchor.length) courtName = courtAnchor.text().trim();

  $("a.noToken").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    const match = text.match(/^(.*?):\s*(\d+)$/);
    if (!match) return;
    courtBreakdown.push({
      courtName: match[1].trim(),
      caseCount: Number(match[2]),
    });
  });

  let currentGroup = null;

  $("#dispTable tbody tr, table#dispTable tbody tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (!tds.length) return;

    // Court name separator row: <td colspan=3 id='td_court_name_X'>
    const firstTd = $(tds[0]);
    if (
      firstTd.attr("colspan") &&
      (firstTd.attr("id") || "").startsWith("td_court_name_")
    ) {
      currentGroup = { courtName: firstTd.text().trim(), cases: [] };
      groupedCases.push(currentGroup);
      return;
    }

    const srNo = $(tds[0]).text().trim();
    if (!srNo || isNaN(Number(srNo))) return;

    const caseTypeNumberYear = $(tds[1]).text().trim();
    const petitionerRespondent = $(tds[2]).text().replace(/\n/g, " ").trim();
    const viewLink = $(tds[3]).find("a");
    const viewDetails = parseViewHistoryOnClick(viewLink.attr("onclick") || "");

    const caseObj = {
      serialNumber: srNo,
      caseTypeNumberYear,
      petitionerRespondent,
      viewDetails,
    };

    if (!currentGroup) {
      currentGroup = { courtName: "", cases: [] };
      groupedCases.push(currentGroup);
    }
    currentGroup.cases.push(caseObj);
  });

  return {
    cases: groupedCases,
    metadata: { totalEstablishments, totalCases, courtName },
    courtBreakdown,
  };
}

function buildPartySearchSuccessResponse({
  normalizedSearch,
  nextCaptcha,
  cases,
  metadata,
  courtBreakdown,
  resolvedState,
  resolvedDist,
  resolvedComplex,
  searchBy = "CSpartyName",
}) {
  return {
    success: true,
    status: normalizedSearch.upstreamStatus ?? 1,
    message: "Valid party-name search result parsed from raw.party_data",
    metadata: {
      totalEstablishments: metadata.totalEstablishments || 0,
      totalCases: metadata.totalCases || 0,
      courtName: metadata.courtName || "",
      searchBy: "partyName",
      searchType: searchBy,
      stateCode: String(resolvedState || ""),
      distCode: String(resolvedDist || ""),
      complexCode: String(resolvedComplex || ""),
    },
    courtBreakdown,
    parsedCases: cases,
    nextCaptcha,
  };
}

/**
 * Parse viewHistory onclick parameters.
 * viewHistory(case_no, cino, court_code, hideparty, search_flag, state_code, dist_code, complex_code, search_by)
 */
function parseViewHistoryOnClick(rawOnClick) {
  const match = rawOnClick.match(/viewHistory\(([^)]+)\)/);
  if (!match) return { rawOnClick };

  const parts = match[1].split(",").map((s) => s.trim().replace(/^'|'$/g, ""));
  return {
    caseNo: parts[0] || "",
    cino: parts[1] || "",
    courtCode: parts[2] || "",
    hideparty: parts[3] || "",
    searchFlag: parts[4] || "",
    stateCode: parts[5] || "",
    distCode: parts[6] || "",
    complexCode: parts[7] || "",
    searchBy: parts[8] || "",
    rawOnClick,
  };
}

/**
 * Parse the full case detail HTML (layer 2 – viewHistory response).
 */
function parseCaseDetail(html) {
  const $ = cheerio.load(html);
  const result = {};

  // ── Case Details table ──
  const caseDetailsTable = $(
    "table.case_details_table, .case_details_table",
  ).first();
  caseDetailsTable.find("tr").each((_, tr) => {
    const cells = $(tr).find("th, td");
    cells.each((i, cell) => {
      const label = $(cell).text().trim().toLowerCase().replace(/\s+/g, "_");
      const nextCell = cells[i + 1];
      if ($(cell).is("th") && nextCell) {
        const value = $(nextCell).text().trim();
        result[label] = value;
      }
    });
  });

  // ── Alternative: key-value rows (th = label, td = value) ──
  $("table.case_details_table tr, table tr").each((_, tr) => {
    const ths = $(tr).find("th");
    const tds = $(tr).find("td");
    if (ths.length === 1 && tds.length === 1) {
      const key = ths.first().text().trim();
      const val = tds.first().text().trim();
      if (key) {
        result[normalizeKey(key)] = val;
      }
    }
  });

  // ── Specific fields via IDs / known labels ──
  result.case_type = extractLabeledField($, "Case Type");
  result.filing_number = extractLabeledField($, "Filing Number");
  result.filing_date = extractLabeledField($, "Filing Date");
  result.registration_number = extractLabeledField($, "Registration Number");
  result.registration_date = extractLabeledField($, "Registration Date");
  result.cnr_number =
    extractLabeledField($, "CNR Number") || $(".cnrno, #cnr_no").text().trim();
  result.efiling_number = extractLabeledField($, "e-Filing Number");
  result.efiling_date = extractLabeledField($, "e-Filing Date");

  // Case Status
  result.first_hearing_date = extractLabeledField($, "First Hearing Date");
  result.next_hearing_date = extractLabeledField($, "Next Hearing Date");
  result.case_stage = extractLabeledField($, "Case Stage");
  result.court_number_and_judge = extractLabeledField(
    $,
    "Court Number and Judge",
  );

  // ── Petitioner and Advocate ──
  result.petitioners = parsePetitionerRespondent($, "Petitioner");
  result.respondents = parsePetitionerRespondent($, "Respondent");

  // ── Acts ──
  result.acts = parseActsTable($);

  // ── IA Status ──
  result.ia_status = parseIaStatusTable($);

  // ── Case History ──
  result.history_of_case_hearing = parseCaseHistoryTable($);

  // ── Interim Orders ──
  result.interim_orders = parseInterimOrdersTable($);

  // ── Connected Cases (if any) ──
  result.connected_cases = parseConnectedCases($);

  return result;
}

function normalizeKey(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function extractLabeledField($, label) {
  let value = "";
  $("td, th").each((_, el) => {
    if ($(el).text().trim().toLowerCase() === label.toLowerCase()) {
      const next = $(el).next("td");
      if (next.length) {
        value = next.text().trim();
        return false; // break
      }
    }
  });
  // Fallback: search inside any element with the label
  if (!value) {
    $("*").each((_, el) => {
      const text = $(el).clone().children().remove().end().text().trim();
      if (text.toLowerCase() === label.toLowerCase()) {
        const next = $(el).next();
        if (next.length) {
          value = next.text().trim();
          return false;
        }
      }
    });
  }
  return value;
}

function parsePetitionerRespondent($, type) {
  const parties = [];
  const heading =
    type === "Petitioner"
      ? "Petitioner and Advocate"
      : "Respondent and Advocate";

  // Find the section
  $("h3, h4, .pra_heading, td").each((_, el) => {
    if ($(el).text().trim().toLowerCase().includes(heading.toLowerCase())) {
      // Collect subsequent text rows until next heading
      let sibling = $(el).parent().next();
      while (sibling.length) {
        const text = sibling.text().trim();
        if (
          !text ||
          text.toLowerCase().includes("petitioner") ||
          text.toLowerCase().includes("respondent")
        )
          break;
        if (text) parties.push(text);
        sibling = sibling.next();
      }
    }
  });

  // Alternative: look for table with petitioner/respondent section
  if (!parties.length) {
    $("table").each((_, table) => {
      const caption = $(table).prev("h3, h4").text().trim();
      if (caption.toLowerCase().includes(type.toLowerCase())) {
        $(table)
          .find("tr")
          .each((_, tr) => {
            const text = $(tr).text().trim();
            if (text) parties.push(text);
          });
      }
    });
  }

  return parties;
}

function parseActsTable($) {
  const acts = [];
  let inActsSection = false;

  $("table").each((_, table) => {
    const prev = $(table).prev("h3, h4, .heading").text().trim();
    if (
      prev.toLowerCase().includes("acts") ||
      $(table).find("th").text().toLowerCase().includes("act")
    ) {
      $(table)
        .find("tbody tr")
        .each((_, tr) => {
          const tds = $(tr).find("td");
          if (tds.length >= 2) {
            acts.push({
              under_act: $(tds[0]).text().trim(),
              under_section: $(tds[1]).text().trim(),
            });
          }
        });
    }
  });

  return acts;
}

function parseIaStatusTable($) {
  const iaRows = [];

  $("table").each((_, table) => {
    const text =
      $(table).prev("h3, h4, .pra_heading").text().trim() +
      $(table).find("th").text();
    if (!text.toLowerCase().includes("ia")) return;

    const headers = [];
    $(table)
      .find("thead th, tr:first-child th")
      .each((_, th) => {
        headers.push($(th).text().trim().toLowerCase().replace(/\s+/g, "_"));
      });

    $(table)
      .find("tbody tr")
      .each((_, tr) => {
        const tds = $(tr).find("td");
        if (!tds.length) return;
        const row = {};

        // IA Number (may be a link)
        const iaLink = $(tds[0]).find("a");
        row.ia_number = iaLink.length
          ? iaLink.text().trim()
          : $(tds[0]).text().trim();
        row.ia_onclick = iaLink.attr("onclick") || "";
        row.ia_href = iaLink.attr("href") || "";
        row.party_name = $(tds[1]).text().trim();
        row.date_of_filing = $(tds[2]).text().trim();
        row.next_date_purpose = $(tds[3]).text().trim();
        row.ia_status = $(tds[4]).text().trim();

        // Parse ia_onclick for viewIABusiness params
        if (row.ia_onclick) {
          row.ia_params = parseViewIABusinessOnClick(row.ia_onclick);
        }

        if (row.ia_number) iaRows.push(row);
      });
  });

  return iaRows;
}

/**
 * Parse viewIABusiness onclick.
 * viewIABusiness(ia_no, cinoia, ia_case_type_name, ia_filno, ia_filyear, national_court_code, search_by)
 */
function parseViewIABusinessOnClick(raw) {
  const match = raw.match(/viewIABusiness\(([^)]+)\)/);
  if (!match) return {};
  const parts = match[1].split(",").map((s) => s.trim().replace(/^'|'$/g, ""));
  return {
    ia_no: parts[0] || "",
    cinoia: parts[1] || "",
    ia_case_type_name: parts[2] || "",
    ia_filno: parts[3] || "",
    ia_filyear: parts[4] || "",
    national_court_code: parts[5] || "",
    search_by: parts[6] || "",
  };
}

function parseCaseHistoryTable($) {
  const history = [];

  $("table").each((_, table) => {
    const heading =
      $(table).prev("h3, h4, .pra_heading").text().trim() +
      $(table).find("caption").text();
    if (
      !heading.toLowerCase().includes("history") &&
      !$(table).find("th").text().toLowerCase().includes("business on date")
    )
      return;

    $(table)
      .find("tbody tr, tr")
      .each((_, tr) => {
        const tds = $(tr).find("td");
        if (tds.length < 3) return;

        const judgeCell = $(tds[0]).text().trim();
        const businessOnDateCell = $(tds[1]);
        const hearingDateCell = $(tds[2]).text().trim();
        const purposeCell = $(tds[3]) ? $(tds[3]).text().trim() : "";

        // "Business on Date" cell is a hyperlink
        const bodLink = businessOnDateCell.find("a");
        const businessOnDate = bodLink.length
          ? bodLink.text().trim()
          : businessOnDateCell.text().trim();
        const bodOnClick = bodLink.attr("onclick") || "";

        if (!businessOnDate && !hearingDateCell) return;

        const row = {
          judge: judgeCell,
          business_on_date: businessOnDate,
          hearing_date: hearingDateCell,
          purpose_of_hearing: purposeCell,
          business_on_date_onclick: bodOnClick,
        };

        // Parse viewBusiness params
        if (bodOnClick) {
          row.business_params = parseViewBusinessOnClick(bodOnClick);
        }

        history.push(row);
      });
  });

  return history;
}

/**
 * Parse viewBusiness onclick.
 * viewBusiness(nextdate1, case_number1, state_code, disposal_flag, businessDate, national_court_code, court_no, search_by, srno)
 */
function parseViewBusinessOnClick(raw) {
  const match = raw.match(/viewBusiness\(([^)]+)\)/);
  if (!match) return {};
  const parts = match[1].split(",").map((s) => s.trim().replace(/^'|'$/g, ""));
  return {
    nextdate1: parts[0] || "",
    case_number1: parts[1] || "",
    state_code: parts[2] || "",
    disposal_flag: parts[3] || "",
    businessDate: parts[4] || "",
    national_court_code: parts[5] || "",
    court_no: parts[6] || "",
    search_by: parts[7] || "",
    srno: parts[8] || "",
  };
}

function parseInterimOrdersTable($) {
  const orders = [];

  $("table").each((_, table) => {
    const heading =
      $(table).prev("h3, h4, .pra_heading").text().trim() +
      $(table).find("caption").text() +
      $(table).find("th").first().text();
    if (!heading.toLowerCase().includes("order")) return;

    $(table)
      .find("tbody tr, tr")
      .each((_, tr) => {
        const tds = $(tr).find("td");
        if (tds.length < 3) return;

        const orderNumber = $(tds[0]).text().trim();
        const orderDate = $(tds[1]).text().trim();
        const orderDetailsCell = $(tds[2]);
        const orderLink = orderDetailsCell.find("a");

        if (!orderNumber && !orderDate) return;

        const row = {
          order_number: orderNumber,
          order_date: orderDate,
          order_details: orderLink.length
            ? orderLink.text().trim()
            : orderDetailsCell.text().trim(),
          order_href: orderLink.attr("href") || "",
          order_onclick: orderLink.attr("onclick") || "",
        };

        // Parse display_pdf params
        if (row.order_onclick) {
          row.pdf_params = parseDisplayPdfOnClick(row.order_onclick);
        }

        orders.push(row);
      });
  });

  return orders;
}

/**
 * Parse displayPDF onclick.
 * displayPDF(normal_v, case_val, court_code, filename, appFlag)
 */
function parseDisplayPdfOnClick(raw) {
  const match = raw.match(/displayPDF\(([^)]+)\)/);
  if (!match) return {};
  const parts = match[1].split(",").map((s) => s.trim().replace(/^'|'$/g, ""));
  return {
    normal_v: parts[0] || "",
    case_val: parts[1] || "",
    court_code: parts[2] || "",
    filename: parts[3] || "",
    appFlag: parts[4] || "",
  };
}

function parseConnectedCases($) {
  const connected = [];
  $("table").each((_, table) => {
    const heading = $(table).prev("h3, h4").text().trim();
    if (!heading.toLowerCase().includes("connected")) return;
    $(table)
      .find("tbody tr")
      .each((_, tr) => {
        const tds = $(tr).find("td");
        if (tds.length >= 2) {
          connected.push({
            case_number: $(tds[0]).text().trim(),
            details: $(tds[1]).text().trim(),
          });
        }
      });
  });
  return connected;
}

/** Parse viewIABusiness JSON response */
function parseIABusinessHtml(html) {
  const $ = cheerio.load(html);
  const caseNo =
    $("table")
      .first()
      .text()
      .match(/Case No[:\-]?\s*([^\n<]+)/i)?.[1]
      ?.trim() || "";
  const rows = [];
  $("table tbody tr, table tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 3) return;
    rows.push({
      ia_no: $(tds[0]).text().trim(),
      business_on_date: $(tds[1]).text().trim(),
      hearing_date: $(tds[2]).text().trim(),
      business: $(tds[3]) ? $(tds[3]).text().trim() : "",
    });
  });
  return { case_no: caseNo, entries: rows };
}

/** Parse viewBusiness JSON response */
// BEFORE
function parseViewBusinessHtml(html) {
  const $ = cheerio.load(html);
  const result = {};
  result.court_name = $("center span").first().text().trim();
  result.court_of = extractLabeledField($, "In the court of");
  result.cnr_number = $("center span b").filter((_, el) => $(el).text().includes("CNR")).parent().text().replace(/CNR Number\s*:/i, "").trim();
  result.case_number = $("center span b").filter((_, el) => $(el).text().includes("Case Number")).parent().text().replace(/Case Number\s*:/i, "").trim();
  result.parties = $("center span").filter((_, el) => $(el).text().includes("versus")).text().trim();
  result.date = $("center span b").filter((_, el) => $(el).text().includes("Date")).parent().text().replace(/Date\s*:/i, "").trim();
  result.business = $("b").filter((_, el) => $(el).text().trim() === "Business").closest("tr").find("td").last().text().trim();
  result.next_purpose = $("b").filter((_, el) => $(el).text().trim() === "Next Purpose").closest("tr").find("td").last().text().trim();
  result.next_hearing_date = $("b").filter((_, el) => $(el).text().trim() === "Next Hearing Date").closest("tr").find("td").last().text().trim();
  return result;
}

// AFTER
function parseViewBusinessHtml(html) {
  const $ = cheerio.load(html);
  const result = {};

  // The portal renders obj.data_list directly — structure is:
  // <center><span>Court Name</span></center>
  // <center><span><b>In the court of&nbsp;</b>:VALUE</span></center>
  // <center><span><b> CNR Number&nbsp;</b>:VALUE</span></center>
  // etc.

  $("center span").each((_, el) => {
    const b = $(el).find("b").first();
    const bText = b.text().replace(/\u00a0/g, " ").trim(); // strip &nbsp;

    if (!bText) {
      // Plain span with no <b> = court name
      const text = $(el).text().trim();
      if (text && !result.court_name) result.court_name = text;
      return;
    }

    // Get the value part: full span text minus the bold label
    const fullText = $(el).text().replace(/\u00a0/g, " ").trim();
    const value = fullText.replace(bText, "").replace(/^[\s:]+/, "").trim();

    if (/in the court of/i.test(bText)) result.court_of = value;
    else if (/cnr number/i.test(bText)) result.cnr_number = value;
    else if (/case number/i.test(bText)) result.case_number = value;
    else if (/^date$/i.test(bText)) result.date = value;
    else if (/versus/.test(fullText) && !bText) result.parties = fullText;
  });

  // parties span has <b>versus</b> inside, handle separately
  $("center span").each((_, el) => {
    if ($(el).find("b").text().replace(/\u00a0/g, " ").trim().toLowerCase() === "versus") {
      result.parties = $(el).text().replace(/\u00a0/g, " ").trim();
    }
  });

  // Table rows: Business, Next Purpose, Next Hearing Date
  $("table tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 3) return;
    const label = $(tds[0]).find("b").text().replace(/\u00a0/g, " ").trim();
    const value = $(tds[2]).text().replace(/\u00a0/g, " ").trim();
    if (/^business$/i.test(label)) result.business = value;
    else if (/next purpose/i.test(label)) result.next_purpose = value;
    else if (/next hearing date/i.test(label)) result.next_hearing_date = value;
  });

  return result;
}

// ─── Layer Fetch Helpers ─────────────────────────────────────────────────────

/** Layer 2: viewHistory – full case detail */
async function fetchViewHistory(session, params) {
  const {
    caseNo,
    cino,
    courtCode,
    hideparty,
    searchFlag,
    stateCode,
    distCode,
    complexCode,
    searchBy,
  } = params;
  const data = await postWithRetry(session, "home/viewHistory", {
    court_code: courtCode,
    state_code: stateCode || session.stateCode,
    dist_code: distCode || session.distCode,
    court_complex_code: complexCode || session.complexCode,
    case_no: caseNo,
    cino,
    hideparty: hideparty || "",
    search_flag: searchFlag || "CScaseNumber",
    search_by: searchBy || "CSpartyName",
  });
  return typeof data === "string"
    ? data
    : data.data_list || JSON.stringify(data);
}

/** Layer 3.1: viewIABusiness */
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
    search_by: iaParams.search_by || "CSpartyName",
  });
  const html = typeof data === "object" ? data.data_list : data;
  return parseIABusinessHtml(html || "");
}

/** Layer 3.2: viewBusiness */
async function fetchViewBusiness(session, bParams, cino) {
  const data = await postWithRetry(session, "home/viewBusiness", {
    court_code: bParams.court_code || "",
    state_code: bParams.state_code || session.stateCode,
    dist_code: session.distCode,
    court_complex_code: session.complexCode,
    nextdate1: bParams.nextdate1,
    case_number1: bParams.case_number1 || cino,
    disposal_flag: bParams.disposal_flag || "Pending",
    businessDate: bParams.businessDate,
    national_court_code: bParams.national_court_code,
    court_no: bParams.court_no,
    search_by: bParams.search_by || "CSpartyName",
    srno: bParams.srno,
  });
  const html = typeof data === "object" ? data.data_list : data;
  return parseViewBusinessHtml(html || "");
}

/** Layer 3.3: display_pdf */
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

// ─── Routes ──────────────────────────────────────────────────────────────────

/**
 * Step 0 — Initialise / warm up a session.
 * The client MUST call this first to get a sessionId.
 */
app.post("/api/partyname/init", async (req, res) => {
  try {
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const session = getSession(sessionId);

    // Hit the index page to obtain initial cookies
    await session.client.get("", {
      params: { p: "casestatus/index", app_token: "" },
    });

    res.json({ success: true, sessionId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Step 1 — Lock in the court complex (set_data).
 * Body: { sessionId, complexCode, stateCode, distCode, estCode? }
 * complexCode example: "1260008@5,6,7@N"
 */
app.post("/api/partyname/court-details", async (req, res) => {
  const { sessionId, complexCode, stateCode, distCode, estCode } = req.body;
  if (!sessionId || !complexCode || !stateCode || !distCode) {
    return res
      .status(400)
      .json({ success: false, error: "Missing required fields" });
  }

  try {
    const session = getSession(sessionId);
    const data = await postWithRetry(session, "casestatus/set_data", {
      p: "casestatus/set_data",
      complex_code: complexCode,
      selected_state_code: stateCode,
      selected_dist_code: distCode,
      selected_est_code: estCode || "null",
    });

    // Persist in session
    session.complexCode =
      typeof data === "object" ? data.complex_code : complexCode.split("@")[0];
    session.stateCode = stateCode;
    session.distCode = distCode;
    session.estCode =
      typeof data === "object" ? data.est_code : estCode || "null";

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Step 2 — Fetch captcha image.
 * Query: ?sessionId=...
 * Returns the captcha image as base64 + cookies.
 *
 * Real eCourts flow (from their JS source):
 *   1. POST  casestatus/getCaptcha  → initializes captcha on server-side PHP session
 *   2. GET   vendor/securimage/securimage_show.php  → returns the captcha PNG
 */
app.get("/api/partyname/captcha", async (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId)
    return res.status(400).json({ success: false, error: "Missing sessionId" });

  try {
    const session = getSession(sessionId);
    const { captcha, contentType } = await fetchCaptchaPayload(session, {
      warm: true,
    });

    res.json({
      success: true,
      captcha,
      contentType,
    });
  } catch (err) {
    console.error("captcha error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/partyname/captcha-debug", async (req, res) => {
  try {
    const session = createSession();

    // 1. INIT SESSION
    await session.client.get("", {
      params: { p: "casestatus/index" },
      headers: {
        "User-Agent": DEFAULT_HEADERS["User-Agent"],
      },
    });

    // 2. POST getCaptcha to init captcha server-side
    await session.client.post("", "ajax_req=true&app_token=", {
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

    // 3. FETCH CAPTCHA IMAGE
    const resp = await session.client.get(
      "vendor/securimage/securimage_show.php",
      {
        params: { t: Date.now() },
        responseType: "stream",
        headers: {
          Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
          "User-Agent": DEFAULT_HEADERS["User-Agent"],
          Referer:
            "https://services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/index",
        },
      },
    );

    // 🔥 DIRECTLY PIPE IMAGE TO BROWSER
    res.setHeader("Content-Type", resp.headers["content-type"] || "image/png");
    resp.data.pipe(res);
  } catch (err) {
    console.error("captcha-debug error:", err.message);
    res.status(500).send(err.message);
  }
});
app.get("/api/partyname/captcha-image", async (req, res) => {
  const { sessionId } = req.query;

  if (!sessionId) {
    return res.status(400).send("Missing sessionId");
  }

  try {
    const session = getSession(sessionId);

    // 1. Warm session
    await session.client.get("", {
      params: { p: "casestatus/index" },
    });

    // 2. POST getCaptcha to init captcha server-side
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

    // 3. FETCH CAPTCHA AS STREAM
    const captchaResp = await session.client.get(
      "vendor/securimage/securimage_show.php",
      {
        params: { t: Date.now() },
        responseType: "stream",
        headers: {
          Accept: "image/webp,image/apng,image/*,*/*;q=0.8",
          Referer:
            "https://services.ecourts.gov.in/ecourtindia_v6/?p=casestatus/index",
        },
      },
    );

    // 🔥 SEND IMAGE DIRECTLY
    res.setHeader(
      "Content-Type",
      captchaResp.headers["content-type"] || "image/png",
    );

    captchaResp.data.pipe(res);
  } catch (err) {
    console.error("captcha-image error:", err.message);
    res.status(500).send(err.message);
  }
});

/**
 * Step 3 — Submit party name search + auto-fetch all sub-layers.
 * Body: {
 *   sessionId, petresName|petres_name, rgyearP, caseStatus|case_status,
 *   captchaCode|fcaptcha_code, stateCode?, distCode?, courtComplexCode?, estCode?
 *   fetchDetails?   (boolean, default false) – fetch viewHistory per case
 *   fetchIABusiness? (boolean, default false) – fetch IA business per IA row
 *   fetchBusiness?  (boolean, default false) – fetch viewBusiness per history row
 *   fetchPdf?       (boolean, default false) – fetch PDF path per order row (slow!)
 * }
 */
app.post("/api/partyname/case-data", async (req, res) => {
  const { sessionId, rgyearP, stateCode, distCode, estCode } = req.body;

  const petresName = firstDefined(req.body.petresName, req.body.petres_name);
  const caseStatus = firstDefined(
    req.body.caseStatus,
    req.body.case_status,
    "Pending",
  );
  const captchaCode = firstDefined(
    req.body.captchaCode,
    req.body.fcaptcha_code,
  );
  const courtComplexCode = firstDefined(
    req.body.courtComplexCode,
    req.body.court_complex_code,
  );
  const fetchDetails = coerceBoolean(req.body.fetchDetails, false);
  const fetchIABusiness = coerceBoolean(req.body.fetchIABusiness, false);
  const fetchBusiness = coerceBoolean(req.body.fetchBusiness, false);
  const fetchPdf = coerceBoolean(req.body.fetchPdf, false);

  if (!sessionId || !petresName || !captchaCode) {
    return res.status(400).json({
      success: false,
      status: 0,
      error:
        "Missing required fields: sessionId, petresName/petres_name, captchaCode/fcaptcha_code",
    });
  }

  try {
    const session = getSession(sessionId);

    // Resolve codes: body overrides > session > error
    const resolvedState = stateCode || session.stateCode;
    const resolvedDist = distCode || session.distCode;
    const resolvedComplex = courtComplexCode || session.complexCode;
    const resolvedEst = estCode || session.estCode || "null";

    if (!resolvedState || !resolvedDist || !resolvedComplex) {
      return res.status(400).json({
        success: false,
        status: 0,
        error:
          "Court details not set. Call /api/partyname/court-details first.",
      });
    }

    // ── Layer 1: submitPartyName ──────────────────────────────────────────
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
      } catch (captchaErr) {
        console.warn("post-submit captcha refresh failed:", captchaErr.message);
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
    } catch (captchaErr) {
      console.warn("post-search captcha refresh failed:", captchaErr.message);
    }
    if (!layer1Html && normalizedSearch.upstreamStatus !== 1) {
      return res.status(422).json({
        success: false,
        status: 0,
        error:
          "Empty response from eCourts. Captcha may be wrong or session expired.",
        nextCaptcha,
      });
    }

    if (!layer1Html) {
      return res.status(422).json({
        success: false,
        status: 0,
        error: "Search completed but no parsable party_data HTML was returned.",
        nextCaptcha,
      });
    }

    const { cases, metadata, courtBreakdown } =
      parsePartyNameResults(layer1Html);

    if (!fetchDetails) {
      return res.json(
        buildPartySearchSuccessResponse({
          normalizedSearch,
          layer1Html,
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

    // ── Layer 2+: fetch full details for each case ────────────────────────
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

        // ── Layer 3.1: IA Business ────────────────────────────────────────
        if (
          fetchIABusiness &&
          caseDetail.ia_status &&
          caseDetail.ia_status.length > 0
        ) {
          for (const ia of caseDetail.ia_status) {
            if (ia.ia_params && ia.ia_params.ia_no) {
              try {
                ia.ia_business = await fetchIABusiness(
                  session,
                  ia.ia_params,
                  vd.cino,
                );
              } catch (e) {
                ia.ia_business = { error: e.message };
              }
            }
          }
        }

        // ── Layer 3.2: Business on Date ───────────────────────────────────
        if (fetchBusiness && caseDetail.history_of_case_hearing) {
          for (const h of caseDetail.history_of_case_hearing) {
            if (h.business_params && h.business_params.businessDate) {
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

        // ── Layer 3.3: PDF paths ──────────────────────────────────────────
        if (fetchPdf && caseDetail.interim_orders) {
          for (const o of caseDetail.interim_orders) {
            if (o.pdf_params && o.pdf_params.normal_v) {
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

      enrichedCases.push({
        ...c,
        details: caseDetail,
      });
    }

    const successPayload = buildPartySearchSuccessResponse({
      normalizedSearch,
      layer1Html,
      nextCaptcha,
      cases: enrichedCases,
      metadata,
      courtBreakdown,
      resolvedState,
      resolvedDist,
      resolvedComplex,
    });

    successPayload.parsedCases = enrichedCases;

    res.json(successPayload);
  } catch (err) {
    console.error("case-data error:", err);
    res.status(500).json({ success: false, status: 0, error: err.message });
  }
});

/**
 * Standalone — fetch single case detail by viewHistory params.
 * Body: { sessionId, caseNo, cino, courtCode, stateCode, distCode, complexCode, searchBy? }
 */
app.post("/api/partyname/case-detail", async (req, res) => {
  const { sessionId, ...params } = req.body;
  if (!sessionId)
    return res.status(400).json({ success: false, error: "Missing sessionId" });

  try {
    const session = getSession(sessionId);
    const html = await fetchViewHistory(session, params);
    const detail = parseCaseDetail(html);
    res.json({ success: true, detail, rawHtml: html });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Standalone — fetch IA business.
 * Body: { sessionId, ia_no, cinoia, ia_case_type_name, ia_filno, ia_filyear, national_court_code, search_by? }
 */
app.post("/api/partyname/ia-business", async (req, res) => {
  const { sessionId, ...iaParams } = req.body;
  if (!sessionId)
    return res.status(400).json({ success: false, error: "Missing sessionId" });

  try {
    const session = getSession(sessionId);
    const result = await fetchIABusiness(session, iaParams, iaParams.cinoia);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Standalone — fetch business-on-date detail.
 * Body: { sessionId, nextdate1, case_number1, state_code, disposal_flag, businessDate,
 *         national_court_code, court_no, search_by, srno }
 */
app.post("/api/partyname/business-detail", async (req, res) => {
  const { sessionId, cino, ...bParams } = req.body;
  if (!sessionId)
    return res.status(400).json({ success: false, error: "Missing sessionId" });

  try {
    const session = getSession(sessionId);
    const result = await fetchViewBusiness(session, bParams, cino);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Standalone — fetch PDF path for an order.
 * Body: { sessionId, normal_v, case_val, court_code, filename, appFlag? }
 */
app.post("/api/partyname/order-pdf", async (req, res) => {
  const { sessionId, ...pdfParams } = req.body;
  if (!sessionId)
    return res.status(400).json({ success: false, error: "Missing sessionId" });

  try {
    const session = getSession(sessionId);
    const result = await fetchDisplayPdf(session, pdfParams);
    res.json({ success: true, result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Health check
app.get("/health", (_, res) => res.json({ ok: true }));

// ─── Start ───────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Jurident eCourts API listening on port ${PORT}`);
});

module.exports = app;
