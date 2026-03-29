"use strict";

function decodeHtmlEntities(text) {
  return String(text || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripTags(text) {
  return decodeHtmlEntities(String(text || "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function parseOptionList(html) {
  const options = [];
  const regex = /<option\b([^>]*)>([\s\S]*?)<\/option>/gi;
  let match;
  while ((match = regex.exec(String(html || "")))) {
    const attrs = match[1] || "";
    const valueMatch =
      attrs.match(/\bvalue=(['"])(.*?)\1/i) ||
      attrs.match(/\bvalue=([^\s>]+)/i);
    const value = valueMatch ? (valueMatch[2] || valueMatch[1] || "") : "";
    const label = stripTags(match[2]);
    if (!value || !label || /^select\b/i.test(label)) continue;
    options.push({ code: value, name: label });
  }
  return options;
}

function normalizeOptionItem(item) {
  if (!item || typeof item !== "object") return null;

  const code =
    item.code ??
    item.value ??
    item.id ??
    item.dist_code ??
    item.state_code ??
    item.complex_code ??
    item.court_complex_code ??
    item.est_code ??
    item.establishment_code ??
    "";

  const name =
    item.name ??
    item.label ??
    item.text ??
    item.dist_name ??
    item.state_name ??
    item.complex_name ??
    item.court_name ??
    item.est_name ??
    item.establishment_name ??
    "";

  if (!code || !name) return null;
  return {
    code: String(code).trim(),
    name: String(name).trim(),
  };
}

function parseOptionObject(payload) {
  if (!payload || typeof payload !== "object") return [];

  if (Array.isArray(payload)) {
    return payload.map(normalizeOptionItem).filter(Boolean);
  }

  for (const value of Object.values(payload)) {
    if (typeof value === "string" && /<option\b/i.test(value)) {
      const parsed = parseOptionList(value);
      if (parsed.length) return parsed;
    }
  }

  const directKeys = [
    "districts",
    "courts",
    "establishments",
    "data",
    "result",
    "options",
    "list",
    "items",
  ];

  for (const key of directKeys) {
    if (Array.isArray(payload[key])) {
      return payload[key].map(normalizeOptionItem).filter(Boolean);
    }
  }

  const values = Object.values(payload);
  for (const value of values) {
    if (Array.isArray(value)) {
      const parsed = value.map(normalizeOptionItem).filter(Boolean);
      if (parsed.length) return parsed;
    }
  }

  const mappedOptions = [];
  for (const [key, value] of Object.entries(payload)) {
    if (
      typeof value === "string" &&
      value.trim() &&
      !/^select\b/i.test(value.trim()) &&
      !/^(success|status|message)$/i.test(key)
    ) {
      mappedOptions.push({
        code: String(key).trim(),
        name: value.trim(),
      });
    }
  }
  return mappedOptions;
}

function parseOptionPayload(payload) {
  if (typeof payload === "string") {
    return parseOptionList(payload);
  }
  if (payload && typeof payload === "object") {
    return parseOptionObject(payload);
  }
  return [];
}

function serializeRawPayload(payload) {
  if (typeof payload === "string") return payload;
  if (payload && typeof payload === "object") {
    try {
      return JSON.stringify(payload);
    } catch (_err) {
      return String(payload);
    }
  }
  return String(payload ?? "");
}

module.exports = {
  parseOptionList,
  parseOptionPayload,
  serializeRawPayload,
};
