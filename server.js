"use strict";

const env = require("./src/config/env");
const app = require("./src/app");

app.listen(env.PORT, "0.0.0.0", () => {
  console.log(`Jurident eCourts API listening on port ${env.PORT}`);
});

module.exports = app;
