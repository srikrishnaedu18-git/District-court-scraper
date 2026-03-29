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
    const valueMatch = attrs.match(/\bvalue=(['"])(.*?)\1/i);
    const value = valueMatch ? valueMatch[2] : "";
    const label = stripTags(match[2]);
    if (!value || !label || /^select\b/i.test(label)) continue;
    options.push({ code: value, name: label });
  }
  return options;
}

module.exports = {
  parseOptionList,
};
