"use strict";

const app = require("./src/app");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Jurident eCourts API listening on port ${PORT}`);
});

module.exports = app;
