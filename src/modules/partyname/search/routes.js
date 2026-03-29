"use strict";

const express = require("express");

const controller = require("./controller");
const validators = require("./validators");
const { PARTYNAME_ROUTE_PATHS } = require("./routePaths");

const router = express.Router();

router.post(
  PARTYNAME_ROUTE_PATHS.CASE_DATA,
  validators.validateCaseData,
  controller.caseData,
);
router.post(
  PARTYNAME_ROUTE_PATHS.CASE_DETAIL,
  validators.validateCaseDetail,
  controller.caseDetail,
);
router.post(
  PARTYNAME_ROUTE_PATHS.IA_BUSINESS,
  validators.validateIaBusiness,
  controller.iaBusiness,
);
router.post(
  PARTYNAME_ROUTE_PATHS.BUSINESS_DETAIL,
  validators.validateBusinessDetailPost,
  controller.businessDetailPost,
);
router.get(
  PARTYNAME_ROUTE_PATHS.BUSINESS_DETAIL,
  validators.validateBusinessDetailGet,
  controller.businessDetailGet,
);
router.get(
  PARTYNAME_ROUTE_PATHS.BUSINESS_DETAIL_PRINT,
  validators.validateBusinessDetailGet,
  controller.businessDetailPrint,
);
router.post(
  PARTYNAME_ROUTE_PATHS.ORDER_PDF,
  validators.validateOrderPdfPost,
  controller.orderPdfPost,
);
router.get(
  PARTYNAME_ROUTE_PATHS.ORDER_PDF,
  validators.validateOrderPdfGet,
  controller.orderPdfGet,
);

module.exports = router;
