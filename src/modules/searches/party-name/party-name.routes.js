"use strict";

const express = require("express");

const controller = require("./party-name.controller");
const validators = require("./party-name.validators");
const portalController = require("../../portal/portal.controller");
const portalValidators = require("../../portal/portal.validators");
const { PARTYNAME_ROUTE_PATHS } = require("./party-name.route-paths");

const router = express.Router();

router.get(
  PARTYNAME_ROUTE_PATHS.CAPTCHA,
  portalValidators.validateSessionIdQuery,
  portalController.captcha,
);
router.get(
  PARTYNAME_ROUTE_PATHS.CAPTCHA_IMAGE,
  portalValidators.validateSessionIdQuery,
  portalController.captchaImage,
);
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
