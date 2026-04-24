const { getKv, setKv } = require("../../db");

const SELECTION_KEY = "dictation_selection";

function normalizeText(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeBookNames(value) {
  return Array.from(
    new Set((Array.isArray(value) ? value : []).map((name) => normalizeText(name)).filter(Boolean)),
  );
}

function normalizeWordIds(value) {
  return Array.from(
    new Set((Array.isArray(value) ? value : []).map((id) => Number(id)).filter((id) => id > 0)),
  );
}

function normalizeSelection(selection) {
  const includedBookNames = normalizeBookNames(selection?.includedBookNames || selection?.bookNames);
  const wordIds = normalizeWordIds(selection?.wordIds);
  return { includedBookNames, wordIds, updatedAt: Date.now() };
}

async function getSelection() {
  const raw = await getKv(SELECTION_KEY);
  if (!raw) {
    return { includedBookNames: [], wordIds: [], updatedAt: 0 };
  }

  try {
    const parsed = JSON.parse(raw);
    const includedBookNames = normalizeBookNames(parsed?.includedBookNames || parsed?.bookNames);
    const wordIds = normalizeWordIds(parsed?.wordIds);
    const updatedAt = Number(parsed?.updatedAt) || 0;
    return { includedBookNames, wordIds, updatedAt };
  } catch {
    return { includedBookNames: [], wordIds: [], updatedAt: 0 };
  }
}

async function setSelection(selection) {
  const normalized = normalizeSelection(selection);
  await setKv(SELECTION_KEY, JSON.stringify(normalized));
  return normalized;
}

module.exports = {
  getSelection,
  setSelection,
};
