"use strict";

const express = require("express");

const controller = require("./portal.controller");
const validators = require("./portal.validators");
const { COMMON_ROUTE_PATHS } = require("./portal.route-paths");

const router = express.Router();

router.post(COMMON_ROUTE_PATHS.INIT, validators.validateInit, controller.init);
router.post(
  COMMON_ROUTE_PATHS.COURT_DETAILS,
  validators.validateCourtDetails,
  controller.courtDetails,
);
router.get(
  COMMON_ROUTE_PATHS.CAPTCHA,
  validators.validateSessionIdQuery,
  controller.captcha,
);
router.get(COMMON_ROUTE_PATHS.CAPTCHA_DEBUG, controller.captchaDebug);
router.get(
  COMMON_ROUTE_PATHS.CAPTCHA_IMAGE,
  validators.validateSessionIdQuery,
  controller.captchaImage,
);
router.all(
  COMMON_ROUTE_PATHS.DISTRICTS,
  validators.validateDistricts,
  controller.districts,
);
router.all(
  COMMON_ROUTE_PATHS.COURTS,
  validators.validateCourts,
  controller.courts,
);
router.all(
  COMMON_ROUTE_PATHS.ESTABLISHMENTS,
  validators.validateEstablishments,
  controller.establishments,
);

module.exports = router;
