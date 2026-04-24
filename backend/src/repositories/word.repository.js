const { all, get, run } = require("../../db");

const DEFAULT_BOOK_NAME = "未命名词书";
const DEFAULT_SOURCE_NAME = "manual-input";

function safeJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeText(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function normalizeLemma(value) {
  return normalizeText(value).toLowerCase();
}

function isPlaceholderDefinition(value) {
  const text = normalizeText(value);
  return Boolean(text && (text.includes("词典未收录") || text.includes("待手动补充")));
}

function hasChineseText(value) {
  return /[\u4E00-\u9FFF]/.test(normalizeText(value));
}

function pickBetterText(current, candidate, { avoidPlaceholder = false } = {}) {
  const a = normalizeText(current);
  const b = normalizeText(candidate);

  if (!a && b) return b;
  if (!b) return a;

  if (avoidPlaceholder) {
    const aBad = isPlaceholderDefinition(a);
    const bBad = isPlaceholderDefinition(b);
    if (aBad && !bBad) return b;
    if (!aBad && bBad) return a;
  }

  if (hasChineseText(b) && !hasChineseText(a)) {
    return b;
  }

  if (b.length > a.length) return b;
  return a;
}

function mapWordRow(row) {
  const { originalFormsJson, ...rest } = row;
  const originalForms = safeJson(originalFormsJson, [row.rawWord || row.lemma]);
  return {
    ...rest,
    originalForms: Array.isArray(originalForms) ? originalForms : [row.rawWord || row.lemma],
  };
}

async function listBookNamesByWordIds(wordIds) {
  const normalized = Array.from(new Set((wordIds || []).map((id) => Number(id)).filter((id) => id > 0)));
  const map = new Map();
  if (!normalized.length) {
    return map;
  }

  const chunkSize = 900;
  for (let index = 0; index < normalized.length; index += chunkSize) {
    const chunk = normalized.slice(index, index + chunkSize);
    const placeholders = chunk.map(() => "?").join(", ");
    const rows = await all(
      `
        SELECT
          bw.word_id AS wordId,
          b.name AS bookName,
          bw.updated_at AS updatedAt
        FROM book_words bw
        JOIN books b ON b.id = bw.book_id
        WHERE bw.word_id IN (${placeholders})
        ORDER BY bw.updated_at DESC, b.name ASC
      `,
      chunk,
    );

    for (const row of rows) {
      const wordId = Number(row.wordId);
      if (!wordId) continue;
      if (!map.has(wordId)) {
        map.set(wordId, []);
      }
      map.get(wordId).push({
        name: row.bookName,
        updatedAt: Number(row.updatedAt) || 0,
      });
    }
  }

  return map;
}

function pickDefaultBook(links) {
  if (!Array.isArray(links) || !links.length) return DEFAULT_BOOK_NAME;
  return (
    links
      .slice()
      .sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0))[0]?.name
    || DEFAULT_BOOK_NAME
  );
}

async function listLibraryEntries(params = {}) {
  const bookName = normalizeText(params.bookName);

  if (bookName) {
    const book = await get(`SELECT id FROM books WHERE name = ?`, [bookName]);
    if (!book?.id) {
      return [];
    }

    const rows = await all(
      `
        SELECT
          w.id,
          w.lemma,
          w.raw_word AS rawWord,
          w.phonetic,
          w.pos,
          w.definition,
          w.example_sentence AS exampleSentence,
          w.last_source AS globalLastSource,
          w.original_forms AS originalFormsJson,
          w.mastery_level AS masteryLevel,
          w.fail_count AS failCount,
          w.dictation_attempts AS dictationAttempts,
          w.created_at AS createdAt,
          w.updated_at AS updatedAt,
          w.next_review_time AS nextReviewTime,
          bw.last_source AS bookLastSource
        FROM words w
        JOIN book_words bw ON bw.word_id = w.id
        WHERE bw.book_id = ?
        ORDER BY w.next_review_time ASC, w.created_at DESC
      `,
      [book.id],
    );

    const wordIds = rows.map((row) => Number(row.id)).filter(Boolean);
    const bookMap = await listBookNamesByWordIds(wordIds);

    return rows.map((row) => {
      const item = mapWordRow(row);
      const { globalLastSource, bookLastSource, ...cleanItem } = item;
      const links = bookMap.get(Number(item.id)) || [];
      const bookNames = Array.from(new Set(links.map((link) => link.name))).filter(Boolean);
      const source = normalizeText(row.bookLastSource) || normalizeText(row.globalLastSource) || "";
      return {
        ...cleanItem,
        bookName,
        bookNames,
        sourceName: source,
        lastSource: source,
      };
    });
  }

  const rows = await all(
    `
      SELECT
        id,
        lemma,
        raw_word AS rawWord,
        phonetic,
        pos,
        definition,
        example_sentence AS exampleSentence,
        last_source AS lastSource,
        original_forms AS originalFormsJson,
        mastery_level AS masteryLevel,
        fail_count AS failCount,
        dictation_attempts AS dictationAttempts,
        created_at AS createdAt,
        updated_at AS updatedAt,
        next_review_time AS nextReviewTime
      FROM words
      ORDER BY next_review_time ASC, created_at DESC
    `,
  );

  const wordIds = rows.map((row) => Number(row.id)).filter(Boolean);
  const bookMap = await listBookNamesByWordIds(wordIds);

  return rows.map((row) => {
    const item = mapWordRow(row);
    const links = bookMap.get(Number(item.id)) || [];
    const defaultBook = pickDefaultBook(links);
    const bookNames = Array.from(new Set(links.map((link) => link.name))).filter(Boolean);
    const lastSource = normalizeText(item.lastSource) || "";

    return {
      ...item,
      bookName: defaultBook,
      bookNames,
      sourceName: lastSource,
      lastSource,
    };
  });
}

async function findLibraryEntryById(id) {
  const wordId = Number(id);
  if (!wordId) return null;

  const row = await get(
    `
      SELECT
        id,
        lemma,
        raw_word AS rawWord,
        phonetic,
        pos,
        definition,
        example_sentence AS exampleSentence,
        last_source AS lastSource,
        original_forms AS originalFormsJson,
        mastery_level AS masteryLevel,
        fail_count AS failCount,
        dictation_attempts AS dictationAttempts,
        created_at AS createdAt,
        updated_at AS updatedAt,
        next_review_time AS nextReviewTime
      FROM words
      WHERE id = ?
      LIMIT 1
    `,
    [wordId],
  );
  if (!row) return null;

  const item = mapWordRow(row);
  const bookMap = await listBookNamesByWordIds([item.id]);
  const links = bookMap.get(Number(item.id)) || [];
  const defaultBook = pickDefaultBook(links);
  const bookNames = Array.from(new Set(links.map((link) => link.name))).filter(Boolean);
  const lastSource = normalizeText(item.lastSource) || "";

  return {
    ...item,
    bookName: defaultBook,
    bookNames,
    sourceName: lastSource,
    lastSource,
  };
}

async function deleteLibraryEntry(id) {
  const wordId = Number(id);
  if (!wordId) return;
  await run(`DELETE FROM words WHERE id = ?`, [wordId]);
}

async function deleteLibraryEntries(ids) {
  const normalized = Array.from(new Set((Array.isArray(ids) ? ids : []).map((id) => Number(id)).filter((id) => id > 0)));
  if (!normalized.length) {
    return { removed: 0 };
  }

  let removedLinks = 0;
  let removedWords = 0;

  const chunkSize = 900;
  for (let index = 0; index < normalized.length; index += chunkSize) {
    const chunk = normalized.slice(index, index + chunkSize);
    const placeholders = chunk.map(() => "?").join(", ");

    const linkResult = await run(
      `
        DELETE FROM book_words
        WHERE word_id IN (${placeholders})
      `,
      chunk,
    );
    removedLinks += Number(linkResult?.changes) || 0;

    const wordResult = await run(
      `
        DELETE FROM words
        WHERE id IN (${placeholders})
      `,
      chunk,
    );
    removedWords += Number(wordResult?.changes) || 0;
  }

  return { removed: removedWords, removedLinks };
}

async function updateLibraryEntryTextFields({ id, definition, exampleSentence, updatedAt }) {
  const wordId = Number(id);
  if (!wordId) return null;

  await run(
    `
      UPDATE words
      SET
        definition = ?,
        example_sentence = ?,
        updated_at = ?
      WHERE id = ?
    `,
    [definition, exampleSentence, updatedAt, wordId],
  );

  return findLibraryEntryById(wordId);
}

async function findDictionaryEntriesByLemma(lemma) {
  return all(
    `
      SELECT
        lemma,
        pos,
        definition,
        example_sentence AS exampleSentence,
        source,
        rank_order AS rankOrder
      FROM dictionary_entries
      WHERE lemma = ?
      ORDER BY rank_order ASC, pos ASC, id ASC
    `,
    [lemma],
  );
}

async function findDictionaryEntriesByLemmas(lemmas) {
  const normalized = Array.from(
    new Set(
      (Array.isArray(lemmas) ? lemmas : [])
        .map((lemma) => normalizeLemma(lemma))
        .filter(Boolean),
    ),
  );
  const map = new Map();

  if (!normalized.length) {
    return map;
  }

  const chunkSize = 900;
  for (let index = 0; index < normalized.length; index += chunkSize) {
    const chunk = normalized.slice(index, index + chunkSize);
    const placeholders = chunk.map(() => "?").join(", ");
    const rows = await all(
      `
        SELECT
          lemma,
          pos,
          definition,
          example_sentence AS exampleSentence,
          source,
          rank_order AS rankOrder
        FROM dictionary_entries
        WHERE lemma IN (${placeholders})
        ORDER BY lemma ASC, rank_order ASC, pos ASC, id ASC
      `,
      chunk,
    );

    for (const row of rows) {
      if (!row || !row.lemma) {
        continue;
      }
      if (!map.has(row.lemma)) {
        map.set(row.lemma, []);
      }
      map.get(row.lemma).push(row);
    }
  }

  return map;
}

async function saveLibraryEntry(entry) {
  const wordId = Number(entry?.id);
  const lemma = normalizeLemma(entry?.lemma);
  const now = Date.now();
  const dictationAttempts =
    entry && Object.prototype.hasOwnProperty.call(entry, "dictationAttempts")
      ? Number(entry.dictationAttempts) || 0
      : null;

  if (wordId) {
    await run(
      `
        UPDATE words
        SET
          lemma = ?,
          raw_word = ?,
          phonetic = ?,
          pos = ?,
          definition = ?,
          example_sentence = ?,
          original_forms = ?,
          mastery_level = ?,
          fail_count = ?,
          dictation_attempts = COALESCE(?, dictation_attempts),
          updated_at = ?,
          next_review_time = ?,
          last_source = ?
        WHERE id = ?
      `,
      [
        lemma,
        normalizeText(entry.rawWord) || lemma,
        normalizeText(entry.phonetic),
        normalizeText(entry.pos),
        normalizeText(entry.definition),
        normalizeText(entry.exampleSentence),
        JSON.stringify(Array.isArray(entry.originalForms) ? entry.originalForms : [entry.rawWord || lemma]),
        Number(entry.masteryLevel) || 0,
        Number(entry.failCount) || 0,
        dictationAttempts,
        Number(entry.updatedAt) || now,
        Number(entry.nextReviewTime) || now,
        normalizeText(entry.lastSource) || normalizeText(entry.sourceName),
        wordId,
      ],
    );

    return findLibraryEntryById(wordId);
  }

  if (!lemma) {
    throw new Error("Missing lemma for saveLibraryEntry");
  }

  await run(
    `
      INSERT INTO words (
        lemma,
        raw_word,
        phonetic,
        pos,
        definition,
        example_sentence,
        original_forms,
        mastery_level,
        fail_count,
        dictation_attempts,
        created_at,
        updated_at,
        next_review_time,
        last_source
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      lemma,
      normalizeText(entry.rawWord) || lemma,
      normalizeText(entry.phonetic),
      normalizeText(entry.pos),
      normalizeText(entry.definition),
      normalizeText(entry.exampleSentence),
      JSON.stringify(Array.isArray(entry.originalForms) ? entry.originalForms : [entry.rawWord || lemma]),
      Number(entry.masteryLevel) || 0,
      Number(entry.failCount) || 0,
      dictationAttempts || 0,
      Number(entry.createdAt) || now,
      Number(entry.updatedAt) || now,
      Number(entry.nextReviewTime) || now,
      normalizeText(entry.lastSource) || normalizeText(entry.sourceName),
    ],
  );

  const row = await get(`SELECT id FROM words WHERE lemma = ?`, [lemma]);
  return row ? findLibraryEntryById(Number(row.id)) : null;
}

async function ensureWordForImport({ lemma, rawWord, pos, definition, exampleSentence, sourceName }) {
  const normalizedLemma = normalizeLemma(lemma);
  if (!normalizedLemma) {
    throw new Error("Missing lemma for import");
  }

  const existing = await get(
    `
      SELECT
        id,
        raw_word AS rawWord,
        pos,
        definition,
        example_sentence AS exampleSentence,
        original_forms AS originalFormsJson,
        last_source AS lastSource
      FROM words
      WHERE lemma = ?
      LIMIT 1
    `,
    [normalizedLemma],
  );

  if (existing?.id) {
    const originalForms = safeJson(existing.originalFormsJson, []);
    const nextForms = new Set(
      (Array.isArray(originalForms) ? originalForms : [])
        .map((value) => normalizeText(value))
        .filter(Boolean),
    );
    if (normalizeText(rawWord)) nextForms.add(normalizeText(rawWord));
    nextForms.add(normalizedLemma);

    const nextLastSource = normalizeText(sourceName) || DEFAULT_SOURCE_NAME;
    const nextPos = pickBetterText(existing.pos, pos);
    const nextDefinition = pickBetterText(existing.definition, definition, { avoidPlaceholder: true });
    const nextExampleSentence = pickBetterText(existing.exampleSentence, exampleSentence);
    const shouldReplaceDefinition = hasChineseText(nextDefinition) && !hasChineseText(existing.definition);
    const shouldUpdateText =
      normalizeText(existing.pos) !== nextPos ||
      normalizeText(existing.definition) !== nextDefinition ||
      normalizeText(existing.exampleSentence) !== nextExampleSentence;

    const now = Date.now();
    await run(
      `
        UPDATE words
        SET
          raw_word = CASE
            WHEN raw_word IS NULL OR TRIM(raw_word) = '' THEN ?
            ELSE raw_word
          END,
          pos = CASE
            WHEN pos IS NULL OR TRIM(pos) = '' THEN ?
            ELSE pos
          END,
          definition = CASE
            WHEN definition IS NULL OR TRIM(definition) = '' OR definition LIKE '%词典未收录%' OR definition LIKE '%待手动补充%' OR ? = 1 THEN ?
            ELSE definition
          END,
          example_sentence = CASE
            WHEN example_sentence IS NULL OR TRIM(example_sentence) = '' THEN ?
            ELSE example_sentence
          END,
          original_forms = ?,
          last_source = ?,
          updated_at = CASE
            WHEN ? = 1 THEN ?
            ELSE updated_at
          END
        WHERE id = ?
      `,
      [
        normalizeText(rawWord) || normalizedLemma,
        nextPos,
        shouldReplaceDefinition ? 1 : 0,
        nextDefinition,
        nextExampleSentence,
        JSON.stringify(Array.from(nextForms)),
        nextLastSource,
        shouldUpdateText ? 1 : 0,
        now,
        existing.id,
      ],
    );

    return { wordId: Number(existing.id), created: false, updated: shouldUpdateText };
  }

  const now = Date.now();
  await run(
    `
      INSERT INTO words (
        lemma,
        raw_word,
        phonetic,
        pos,
        definition,
        example_sentence,
        original_forms,
        mastery_level,
        fail_count,
        created_at,
        updated_at,
        next_review_time,
        last_source
      )
      VALUES (?, ?, '', ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)
    `,
    [
      normalizedLemma,
      normalizeText(rawWord) || normalizedLemma,
      normalizeText(pos),
      normalizeText(definition),
      normalizeText(exampleSentence),
      JSON.stringify([normalizeText(rawWord) || normalizedLemma, normalizedLemma]),
      now,
      now,
      now,
      normalizeText(sourceName) || DEFAULT_SOURCE_NAME,
    ],
  );

  const row = await get(`SELECT id FROM words WHERE lemma = ?`, [normalizedLemma]);
  return { wordId: Number(row.id), created: true, updated: false };
}

async function insertParseHistory(entry) {
  await run(
    `
      INSERT INTO parse_history (
        id, created_at, source_name, book_name, mode, llm_used, warning, fingerprint, candidate_count
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      entry.id,
      entry.createdAt,
      entry.sourceName || DEFAULT_SOURCE_NAME,
      entry.bookName || DEFAULT_BOOK_NAME,
      entry.mode || "normal",
      entry.llmUsed ? 1 : 0,
      entry.warning || "",
      entry.fingerprint || "",
      entry.candidateCount || 0,
    ],
  );
}

module.exports = {
  listLibraryEntries,
  findLibraryEntryById,
  deleteLibraryEntry,
  deleteLibraryEntries,
  updateLibraryEntryTextFields,
  findDictionaryEntriesByLemma,
  findDictionaryEntriesByLemmas,
  saveLibraryEntry,
  ensureWordForImport,
  insertParseHistory,
};
