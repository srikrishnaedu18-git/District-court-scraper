"use strict";

const PDFDocument = require("pdfkit");

function buildBusinessDetailPdfBuffer(details) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 50,
      info: {
        Title: `Business Details - ${details.case_number || "Case"}`,
      },
    });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(18).text("Daily Status", { align: "center" });
    doc.moveDown(0.5);

    if (details.court_name) {
      doc.fontSize(14).text(details.court_name, { align: "center" });
      doc.moveDown(0.25);
    }

    const rows = [
      ["In the Court of", details.court_of],
      ["CNR Number", details.cnr_number],
      ["Case Number", details.case_number],
      ["Date", details.date],
      ["Parties", details.parties],
      ["Business", details.business],
      ["Next Purpose", details.next_purpose],
      ["Next Hearing Date", details.next_hearing_date],
    ];

    doc.moveDown(1);
    rows.forEach(([label, value]) => {
      if (!value) return;
      doc.font("Helvetica-Bold").fontSize(11).text(`${label}:`, {
        continued: true,
      });
      doc.font("Helvetica").text(` ${value}`);
      doc.moveDown(0.4);
    });

    doc.end();
  });
}

module.exports = {
  buildBusinessDetailPdfBuffer,
};
