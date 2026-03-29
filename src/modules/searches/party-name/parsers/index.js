"use strict";

const cheerio = require("cheerio");

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

function normalizeViewBusinessResponse(payload) {
  if (typeof payload === "string") {
    return {
      html: payload,
      raw: payload,
      upstreamStatus: null,
    };
  }

  if (!payload || typeof payload !== "object") {
    return {
      html: "",
      raw: payload,
      upstreamStatus: null,
    };
  }

  return {
    html: payload.data_list || payload.business_data || "",
    raw: payload,
    upstreamStatus:
      payload.status !== undefined && payload.status !== null
        ? Number(payload.status)
        : null,
  };
}

function parsePartyNameResults(html) {
  const $ = cheerio.load(html);
  const cases = [];
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

  $("#dispTable tbody tr, table#dispTable tbody tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 3) return;

    const srNo = $(tds[0]).text().trim();
    if (!srNo || Number.isNaN(Number(srNo))) return;

    const caseTypeNumberYear = $(tds[1]).text().trim();
    const petitionerRespondent = $(tds[2]).text().replace(/\n/g, " ").trim();
    const viewLink = $(tds[3]).find("a");

    cases.push({
      serialNumber: srNo,
      caseTypeNumberYear,
      petitionerRespondent,
      viewDetails: parseViewHistoryOnClick(viewLink.attr("onclick") || ""),
    });
  });

  return {
    cases,
    metadata: { totalEstablishments, totalCases, courtName },
    courtBreakdown,
  };
}

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

function normalizeKey(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function extractLabeledField($, label) {
  let value = "";
  $("td, th").each((_, el) => {
    if ($(el).text().trim().toLowerCase() === label.toLowerCase()) {
      const next = $(el).next("td");
      if (next.length) {
        value = next.text().trim();
        return false;
      }
    }
    return undefined;
  });

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
      return undefined;
    });
  }
  return value;
}

function parsePetitionerRespondent($, type) {
  const parties = [];
  const heading =
    type === "Petitioner" ? "Petitioner and Advocate" : "Respondent and Advocate";

  $("h3, h4, .pra_heading, td").each((_, el) => {
    if ($(el).text().trim().toLowerCase().includes(heading.toLowerCase())) {
      let sibling = $(el).parent().next();
      while (sibling.length) {
        const text = sibling.text().trim();
        if (
          !text ||
          text.toLowerCase().includes("petitioner") ||
          text.toLowerCase().includes("respondent")
        ) {
          break;
        }
        if (text) parties.push(text);
        sibling = sibling.next();
      }
    }
  });

  if (!parties.length) {
    $("table").each((_, table) => {
      const caption = $(table).prev("h3, h4").text().trim();
      if (caption.toLowerCase().includes(type.toLowerCase())) {
        $(table).find("tr").each((__, tr) => {
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
  $("table").each((_, table) => {
    const prev = $(table).prev("h3, h4, .heading").text().trim();
    if (
      !prev.toLowerCase().includes("acts") &&
      !$(table).find("th").text().toLowerCase().includes("act")
    ) {
      return;
    }
    $(table).find("tbody tr").each((__, tr) => {
      const tds = $(tr).find("td");
      if (tds.length >= 2) {
        acts.push({
          under_act: $(tds[0]).text().trim(),
          under_section: $(tds[1]).text().trim(),
        });
      }
    });
  });
  return acts;
}

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

function parseIaStatusTable($) {
  const iaRows = [];
  $("table").each((_, table) => {
    const text =
      $(table).prev("h3, h4, .pra_heading").text().trim() +
      $(table).find("th").text();
    if (!text.toLowerCase().includes("ia")) return;

    $(table).find("tbody tr").each((__, tr) => {
      const tds = $(tr).find("td");
      if (!tds.length) return;
      const iaLink = $(tds[0]).find("a");

      const row = {
        ia_number: iaLink.length ? iaLink.text().trim() : $(tds[0]).text().trim(),
        ia_onclick: iaLink.attr("onclick") || "",
        ia_href: iaLink.attr("href") || "",
        party_name: $(tds[1]).text().trim(),
        date_of_filing: $(tds[2]).text().trim(),
        next_date_purpose: $(tds[3]).text().trim(),
        ia_status: $(tds[4]).text().trim(),
      };

      if (row.ia_onclick) {
        row.ia_params = parseViewIABusinessOnClick(row.ia_onclick);
      }

      if (row.ia_number) iaRows.push(row);
    });
  });
  return iaRows;
}

function parseViewBusinessOnClick(raw) {
  const match = raw.match(/viewBusiness\(([^)]+)\)/);
  if (!match) return {};
  const parts = match[1].split(",").map((s) => s.trim().replace(/^'|'$/g, ""));

  if (parts.length >= 11) {
    return {
      court_code: parts[0] || "",
      dist_code: parts[1] || "",
      nextdate1: parts[2] || "",
      case_number1: parts[3] || "",
      state_code: parts[4] || "",
      disposal_flag: parts[5] || "",
      businessDate: parts[6] || "",
      court_no: parts[7] || "",
      national_court_code: parts[8] || "",
      search_by: parts[9] || "",
      srno: parts[10] || "",
    };
  }

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

function parseCaseHistoryTable($) {
  const history = [];
  $("table").each((_, table) => {
    const heading =
      $(table).prev("h3, h4, .pra_heading").text().trim() +
      $(table).find("caption").text();
    if (
      !heading.toLowerCase().includes("history") &&
      !$(table).find("th").text().toLowerCase().includes("business on date")
    ) {
      return;
    }

    $(table).find("tbody tr, tr").each((__, tr) => {
      const tds = $(tr).find("td");
      if (tds.length < 3) return;

      const bodLink = $(tds[1]).find("a");
      const businessOnDate = bodLink.length
        ? bodLink.text().trim()
        : $(tds[1]).text().trim();
      const bodOnClick = bodLink.attr("onclick") || "";

      if (!businessOnDate && !$(tds[2]).text().trim()) return;

      const row = {
        judge: $(tds[0]).text().trim(),
        business_on_date: businessOnDate,
        hearing_date: $(tds[2]).text().trim(),
        purpose_of_hearing: tds[3] ? $(tds[3]).text().trim() : "",
        business_on_date_onclick: bodOnClick,
      };

      if (bodOnClick) {
        row.business_params = parseViewBusinessOnClick(bodOnClick);
      }

      history.push(row);
    });
  });
  return history;
}

function parseDisplayPdfOnClick(raw) {
  const match = raw.match(/displayPdf\(([^)]+)\)/i);
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

function parseInterimOrdersTable($) {
  const orders = [];
  $("table").each((_, table) => {
    const heading =
      $(table).prev("h3, h4, .pra_heading").text().trim() +
      $(table).find("caption").text() +
      $(table).find("th").first().text();
    if (!heading.toLowerCase().includes("order")) return;

    $(table).find("tbody tr, tr").each((__, tr) => {
      const tds = $(tr).find("td");
      if (tds.length < 3) return;

      const orderDetailsCell = $(tds[2]);
      const orderLink = orderDetailsCell.find("a");
      const row = {
        order_number: $(tds[0]).text().trim(),
        order_date: $(tds[1]).text().trim(),
        order_details: orderLink.length
          ? orderLink.text().trim()
          : orderDetailsCell.text().trim(),
        order_href: orderLink.attr("href") || "",
        order_onclick: orderLink.attr("onclick") || "",
      };

      if (!row.order_number && !row.order_date) return;
      if (row.order_onclick) {
        row.pdf_params = parseDisplayPdfOnClick(row.order_onclick);
      }
      orders.push(row);
    });
  });
  return orders;
}

function parseConnectedCases($) {
  const connected = [];
  $("table").each((_, table) => {
    const heading = $(table).prev("h3, h4").text().trim();
    if (!heading.toLowerCase().includes("connected")) return;
    $(table).find("tbody tr").each((__, tr) => {
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

function parseCaseDetail(html) {
  const $ = cheerio.load(html);
  const result = {};

  $("table.case_details_table, .case_details_table")
    .first()
    .find("tr")
    .each((_, tr) => {
      const cells = $(tr).find("th, td");
      cells.each((index, cell) => {
        const label = $(cell).text().trim().toLowerCase().replace(/\s+/g, "_");
        const nextCell = cells[index + 1];
        if ($(cell).is("th") && nextCell) {
          result[label] = $(nextCell).text().trim();
        }
      });
    });

  $("table.case_details_table tr, table tr").each((_, tr) => {
    const ths = $(tr).find("th");
    const tds = $(tr).find("td");
    if (ths.length === 1 && tds.length === 1) {
      const key = ths.first().text().trim();
      const val = tds.first().text().trim();
      if (key) result[normalizeKey(key)] = val;
    }
  });

  result.case_type = extractLabeledField($, "Case Type");
  result.filing_number = extractLabeledField($, "Filing Number");
  result.filing_date = extractLabeledField($, "Filing Date");
  result.registration_number = extractLabeledField($, "Registration Number");
  result.registration_date = extractLabeledField($, "Registration Date");
  result.cnr_number =
    extractLabeledField($, "CNR Number") || $(".cnrno, #cnr_no").text().trim();
  result.efiling_number = extractLabeledField($, "e-Filing Number");
  result.efiling_date = extractLabeledField($, "e-Filing Date");
  result.first_hearing_date = extractLabeledField($, "First Hearing Date");
  result.next_hearing_date = extractLabeledField($, "Next Hearing Date");
  result.case_stage = extractLabeledField($, "Case Stage");
  result.court_number_and_judge = extractLabeledField($, "Court Number and Judge");
  result.petitioners = parsePetitionerRespondent($, "Petitioner");
  result.respondents = parsePetitionerRespondent($, "Respondent");
  result.acts = parseActsTable($);
  result.ia_status = parseIaStatusTable($);
  result.history_of_case_hearing = parseCaseHistoryTable($);
  result.interim_orders = parseInterimOrdersTable($);
  result.connected_cases = parseConnectedCases($);

  return result;
}

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
      business: tds[3] ? $(tds[3]).text().trim() : "",
    });
  });

  return { case_no: caseNo, entries: rows };
}

function parseViewBusinessHtml(html) {
  const $ = cheerio.load(html);
  const result = {};

  $("center span").each((_, el) => {
    const b = $(el).find("b").first();
    const bText = b.text().replace(/\u00a0/g, " ").trim();

    if (!bText) {
      const text = $(el).text().trim();
      if (text && !result.court_name) result.court_name = text;
      return;
    }

    const fullText = $(el).text().replace(/\u00a0/g, " ").trim();
    const value = fullText.replace(bText, "").replace(/^[\s:]+/, "").trim();

    if (/in the court of/i.test(bText)) result.court_of = value;
    else if (/cnr number/i.test(bText)) result.cnr_number = value;
    else if (/case number/i.test(bText)) result.case_number = value;
    else if (/^date$/i.test(bText)) result.date = value;
  });

  $("center span").each((_, el) => {
    if (
      $(el)
        .find("b")
        .text()
        .replace(/\u00a0/g, " ")
        .trim()
        .toLowerCase() === "versus"
    ) {
      result.parties = $(el).text().replace(/\u00a0/g, " ").trim();
    }
  });

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

module.exports = {
  normalizePartySearchResponse,
  normalizeViewBusinessResponse,
  parsePartyNameResults,
  parseViewHistoryOnClick,
  parseCaseDetail,
  parseViewIABusinessOnClick,
  parseViewBusinessOnClick,
  parseDisplayPdfOnClick,
  parseIABusinessHtml,
  parseViewBusinessHtml,
};
