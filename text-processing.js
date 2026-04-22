const fs = require("node:fs");
const path = require("node:path");

const POS_STOPWORDS = new Set([
  "adj",
  "adjective",
  "adv",
  "adverb",
  "aux",
  "auxiliary",
  "conj",
  "conjunction",
  "det",
  "determiner",
  "n",
  "noun",
  "num",
  "number",
  "ordinal",
  "participle",
  "phr",
  "phrase",
  "pl",
  "plural",
  "prep",
  "preposition",
  "pron",
  "pronoun",
  "singular",
  "symbol",
  "v",
  "verb",
  "vi",
  "vt",
]);

const ROOT_DIR = __dirname;
const OEWN_DIR = path.join(ROOT_DIR, "data", "oewn2024");

const LEMMA_EXCEPTIONS = loadLemmaExceptions();
const KNOWN_LEMMAS = loadKnownLemmas();
const POS_MARKER_PATTERN = /\b(adj|adjective|adv|adverb|aux|auxiliary|conj|conjunction|det|determiner|n|noun|num|number|prep|preposition|pron|pronoun|v|verb|vi|vt)\s*\.?/i;

function prepareTextForParsing(text) {
  return stripPosMarkers(normalizeDocumentText(text));
}

function normalizeDocumentText(input) {
  return String(input || "")
    .normalize("NFKC")
    .replace(/\u00ad/g, "")
    .replace(/[\u200b-\u200d\u2060\ufeff]/g, "")
    .replace(/[“”„‟]/g, "\"")
    .replace(/[‘’‚‛]/g, "'")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/[•◦▪■]/g, " ")
    .replace(/([A-Za-z])-\s*\n\s*([A-Za-z])/g, "$1$2")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[^\x09\x0a\x20-\x7e]/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function splitSentences(text) {
  return prepareTextForParsing(text)
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+|(?<=\.)\s+(?=[A-Z])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function extractWordStats(text) {
  const prepared = prepareTextForParsing(text);
  const tokens = prepared.match(/[A-Za-z]+(?:[\'’-][A-Za-z]+)*/g) || [];
  const counts = new Map();
  const rawForms = new Map();

  for (const token of tokens) {
    const normalized = normalizeRawToken(token);
    if (!normalized || !isUsefulWord(normalized)) {
      continue;
    }

    const lemma = lemmatize(normalized);
    if (!lemma || !isUsefulWord(lemma)) {
      continue;
    }

    counts.set(lemma, (counts.get(lemma) || 0) + 1);
    if (!rawForms.has(lemma)) {
      rawForms.set(lemma, normalized);
    }
  }

  return [...counts.entries()]
    .map(([lemma, frequency]) => ({
      lemma,
      rawWord: rawForms.get(lemma) || lemma,
      frequency,
      fromGlossary: false,
    }))
    .sort((a, b) => b.frequency - a.frequency || a.lemma.localeCompare(b.lemma));
}

function extractVocabularyEntries(text, options = {}) {
  const { limit = 80, glossaryLimit = 5000 } = options;
  const glossary = extractGlossaryEntries(text);
  if (glossary.detected) {
    return glossary.entries.slice(0, glossaryLimit);
  }
  return extractWordStats(text).slice(0, limit);
}

function stripPosMarkers(text) {
  return String(text || "").replace(
    /\b(?:adj|adjective|adv|adverb|aux|auxiliary|conj|conjunction|det|determiner|n|noun|num|number|prep|preposition|pron|pronoun|v|verb|vi|vt)\.(?=\s|$)/gi,
    " ",
  );
}

function normalizeRawToken(token) {
  const normalized = String(token || "")
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/^[^a-z]+|[^a-z]+$/g, "")
    .replace(/(?:'s|s')$/i, "")
    .replace(/^-+|-+$/g, "")
    .replace(/'+/g, "'");

  if (!normalized || normalized.length < 3) {
    return "";
  }

  return normalized;
}

function normalizeGlossaryPosLine(line) {
  return String(line || "")
    .replace(/\ba\s*dj\s*\.?/gi, " adj. ")
    .replace(/\ba\s*dv\s*\.?/gi, " adv. ")
    .replace(/\bp\s*rep\s*\.?/gi, " prep. ")
    .replace(/\bp\s*ron\s*\.?/gi, " pron. ")
    .replace(/\bc\s*onj\s*\.?/gi, " conj. ")
    .replace(/\bd\s*et\s*\.?/gi, " det. ")
    .replace(/\bn\s*\.?/gi, " n. ")
    .replace(/\bv\s*i\s*\.?/gi, " vi. ")
    .replace(/\bv\s*t\s*\.?/gi, " vt. ")
    .replace(/\bv\s*\.?/gi, " v. ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractGlossaryEntries(text) {
  const normalized = normalizeDocumentText(text);
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const entries = [];
  const seen = new Set();
  let markerHits = 0;

  for (const rawLine of lines) {
    const line = normalizeGlossaryPosLine(rawLine);
    const marker = POS_MARKER_PATTERN.exec(line);
    if (!marker || marker.index > 40) {
      continue;
    }

    markerHits += 1;
    const head = line.slice(0, marker.index).trim();
    const rawWord = resolveGlossaryHeadword(head);
    if (!rawWord || !isUsefulGlossaryWord(rawWord)) {
      continue;
    }

    const lemma = rawWord.length <= 2 ? rawWord : lemmatize(rawWord);
    if (!lemma || !isUsefulGlossaryWord(lemma) || seen.has(lemma)) {
      continue;
    }

    seen.add(lemma);
    entries.push({
      lemma,
      rawWord,
      frequency: 1,
      fromGlossary: true,
    });
  }

  const detected = markerHits >= 20 && entries.length >= 20 && (entries.length / Math.max(lines.length, 1)) >= 0.08;
  return { detected, entries };
}

function resolveGlossaryHeadword(head) {
  const cleaned = String(head || "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\s*=\s*/g, " ")
    .replace(/\s*&\s*/g, " ")
    .replace(/[.,:;]+$/g, " ")
    .trim();

  if (!cleaned) {
    return "";
  }

  const parts = cleaned
    .split(/[;,]/)
    .flatMap((part) => part.split(/\s+or\s+|\s*\/\s*/i))
    .map((part) => part.trim())
    .filter(Boolean);

  const candidates = [];
  for (const part of parts) {
    const tokens = part.match(/[A-Za-z]+(?:'[A-Za-z]+)?/g) || [];
    if (!tokens.length) {
      continue;
    }

    const compact = tokens.join("").toLowerCase();
    const first = tokens[0].toLowerCase();
    const last = tokens[tokens.length - 1].toLowerCase();

    if (compact) {
      candidates.push(compact);
    }
    if (first) {
      candidates.push(first);
    }
    if (last && last !== first) {
      candidates.push(last);
    }
  }

  for (const candidate of candidates) {
    if (KNOWN_LEMMAS.has(candidate) || LEMMA_EXCEPTIONS.has(candidate)) {
      return candidate;
    }
  }

  return candidates.find(isUsefulGlossaryWord) || "";
}

function isUsefulWord(word) {
  return Boolean(
    word &&
    word.length >= 3 &&
    /^[a-z]+(?:-[a-z]+)?$/.test(word) &&
    !/\d/.test(word) &&
    !POS_STOPWORDS.has(word),
  );
}

function isUsefulGlossaryWord(word) {
  return Boolean(
    word &&
    (word.length >= 3 || (word.length === 2 && KNOWN_LEMMAS.has(word))) &&
    /^[a-z]+(?:-[a-z]+)?$/.test(word) &&
    !/\d/.test(word) &&
    !POS_STOPWORDS.has(word),
  );
}

function lemmatize(word) {
  const normalized = normalizeRawToken(word);
  if (!normalized) {
    return "";
  }

  const direct = LEMMA_EXCEPTIONS.get(normalized);
  if (direct) {
    return direct;
  }

  if (KNOWN_LEMMAS.has(normalized)) {
    return normalized;
  }

  const candidates = buildLemmaCandidates(normalized);
  for (const candidate of candidates) {
    if (KNOWN_LEMMAS.has(candidate)) {
      return candidate;
    }
  }

  return candidates[0] || normalized;
}

function buildLemmaCandidates(word) {
  const candidates = [word];
  const push = (candidate) => {
    if (candidate && !candidates.includes(candidate) && isUsefulWord(candidate)) {
      candidates.push(candidate);
    }
  };

  if (word.endsWith("ies") && word.length > 4) {
    push(`${word.slice(0, -3)}y`);
  }
  if (word.endsWith("ied") && word.length > 4) {
    push(`${word.slice(0, -3)}y`);
  }
  if (word.endsWith("ves") && word.length > 4) {
    push(`${word.slice(0, -3)}f`);
    push(`${word.slice(0, -3)}fe`);
  }
  if (word.endsWith("men") && word.length > 4) {
    push(`${word.slice(0, -3)}man`);
  }
  if (word.endsWith("es") && word.length > 4) {
    if (/(ches|shes|sses|xes|zes|oes)$/.test(word)) {
      push(word.slice(0, -2));
    }
  }
  if (word.endsWith("s") && word.length > 3 && !word.endsWith("ss")) {
    push(word.slice(0, -1));
  }
  if (word.endsWith("ing") && word.length > 5) {
    const stem = word.slice(0, -3);
    push(stem);
    push(`${stem}e`);
    if (hasDoubledFinalConsonant(stem)) {
      push(stem.slice(0, -1));
    }
  }
  if (word.endsWith("ed") && word.length > 4) {
    const stem = word.slice(0, -2);
    push(stem);
    push(`${stem}e`);
    if (hasDoubledFinalConsonant(stem)) {
      push(stem.slice(0, -1));
    }
  }
  if (word.endsWith("er") && word.length > 4) {
    const stem = word.slice(0, -2);
    push(stem);
    push(`${stem}e`);
    if (hasDoubledFinalConsonant(stem)) {
      push(stem.slice(0, -1));
    }
  }
  if (word.endsWith("est") && word.length > 5) {
    const stem = word.slice(0, -3);
    push(stem);
    push(`${stem}e`);
    if (hasDoubledFinalConsonant(stem)) {
      push(stem.slice(0, -1));
    }
  }
  if (word.endsWith("ly") && word.length > 4) {
    push(word.slice(0, -2));
  }

  return candidates;
}

function hasDoubledFinalConsonant(stem) {
  return /([b-df-hj-np-tv-z])\1$/i.test(stem || "");
}

function loadLemmaExceptions() {
  const map = new Map();
  ["noun.exc", "verb.exc", "adj.exc", "adv.exc"].forEach((filename) => {
    const filePath = path.join(OEWN_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return;
    }

    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(" ")) {
        continue;
      }
      const [inflected, lemma] = trimmed.split(/\s+/);
      if (inflected && lemma) {
        map.set(inflected.toLowerCase(), lemma.toLowerCase());
      }
    }
  });
  return map;
}

function loadKnownLemmas() {
  const set = new Set();
  ["index.noun", "index.verb", "index.adj", "index.adv"].forEach((filename) => {
    const filePath = path.join(OEWN_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return;
    }

    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(" ")) {
        continue;
      }
      const lemma = trimmed.split(/\s+/)[0];
      if (lemma && /^[a-z][a-z_-]*$/i.test(lemma)) {
        set.add(lemma.replace(/_/g, " ").toLowerCase());
        if (!lemma.includes("_")) {
          set.add(lemma.toLowerCase());
        }
      }
    }
  });
  return set;
}

module.exports = {
  POS_STOPWORDS,
  extractVocabularyEntries,
  extractWordStats,
  lemmatize,
  normalizeDocumentText,
  prepareTextForParsing,
  splitSentences,
  stripPosMarkers,
};
