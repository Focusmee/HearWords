const { getKv, setKv } = require("../../db");

const SESSION_KEY = "dictation_session";

async function getRawSession() {
  return getKv(SESSION_KEY);
}

async function setRawSession(rawSessionJson) {
  await setKv(SESSION_KEY, rawSessionJson);
}

module.exports = {
  getRawSession,
  setRawSession,
};

