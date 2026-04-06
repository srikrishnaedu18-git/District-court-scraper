"use strict";

const express = require("express");

const controller = require("./case-number.controller");
const validators = require("./case-number.validators");
const portalController = require("../../portal/portal.controller");
const portalValidators = require("../../portal/portal.validators");
const { CASENUMBER_ROUTE_PATHS } = require("./case-number.route-paths");

const router = express.Router();

router.get(
  CASENUMBER_ROUTE_PATHS.CAPTCHA,
  portalValidators.validateSessionIdQuery,
  portalController.captcha,
);
router.get(
  CASENUMBER_ROUTE_PATHS.CAPTCHA_IMAGE,
  portalValidators.validateSessionIdQuery,
  portalController.captchaImage,
);
router.post(
  CASENUMBER_ROUTE_PATHS.CASE_TYPES,
  validators.validateCaseTypes,
  controller.caseTypes,
);
router.post(
  CASENUMBER_ROUTE_PATHS.CASE_DATA,
  validators.validateCaseData,
  controller.caseData,
);
router.post(
  CASENUMBER_ROUTE_PATHS.CASE_DETAIL,
  validators.validateCaseDetail,
  controller.caseDetail,
);
router.post(
  CASENUMBER_ROUTE_PATHS.IA_BUSINESS,
  validators.validateIaBusiness,
  controller.iaBusiness,
);
router.post(
  CASENUMBER_ROUTE_PATHS.BUSINESS_DETAIL,
  validators.validateBusinessDetailPost,
  controller.businessDetailPost,
);
router.post(
  CASENUMBER_ROUTE_PATHS.ORDER_PDF,
  validators.validateOrderPdfPost,
  controller.orderPdfPost,
);
router.get(
  CASENUMBER_ROUTE_PATHS.ORDER_PDF,
  validators.validateOrderPdfGet,
  controller.orderPdfGet,
);

module.exports = router;
