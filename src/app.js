"use strict";

require("dotenv").config();

const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const commonRoutes = require("./modules/common/routes");
const partynameSearchRoutes = require("./modules/partyname/search/routes");
const { notFound } = require("./middleware/notFound");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();

app.use(cors());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/common", commonRoutes);
app.use("/api/partyname", partynameSearchRoutes);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use(notFound);
app.use(errorHandler);

module.exports = app;
