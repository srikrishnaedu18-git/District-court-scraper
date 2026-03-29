"use strict";

const axios = require("axios");
const { wrapper } = require("axios-cookiejar-support");
const { CookieJar } = require("tough-cookie");

const { BASE_URL, DEFAULT_HEADERS } = require("../../../config/ecourts");

const sessions = new Map();

function createSession() {
  const jar = new CookieJar();
  const client = wrapper(
    axios.create({
      jar,
      withCredentials: true,
      baseURL: BASE_URL,
      timeout: 30000,
      headers: DEFAULT_HEADERS,
    }),
  );

  return {
    jar,
    client,
    appToken: "",
    complexCode: "",
    stateCode: "",
    distCode: "",
    estCode: "",
  };
}

function getSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, createSession());
  }
  return sessions.get(sessionId);
}

module.exports = {
  createSession,
  getSession,
  sessions,
};
