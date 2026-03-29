"use strict";

function notFound(req, res) {
  return res.status(404).json({
    success: false,
    status: 0,
    message: "Not Found",
    result: {},
    rawHtml: null,
    path: req.originalUrl,
  });
}

module.exports = {
  notFound,
};
