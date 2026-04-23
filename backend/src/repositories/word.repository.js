const { all, get, run } = require("../../db");

function mapLibraryRow(row) {
  const { originalFormsJson, ...rest } = row;
  return {
    ...rest,
    originalForms: safeJson(originalFormsJson, [row.rawWord]),
  };
}

async function listLibraryEntries() {
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
        source_name AS sourceName,
        book_name AS bookName,
        last_source AS lastSource,
        original_forms AS originalFormsJson,
        mastery_level AS masteryLevel,
        fail_count AS failCount,
        created_at AS createdAt,
        updated_at AS updatedAt,
        next_review_time AS nextReviewTime
      FROM library_entries
      ORDER BY next_review_time ASC, created_at DESC
    `,
  );

  return rows.map(mapLibraryRow);
}

async function findLibraryEntryById(id) {
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
        source_name AS sourceName,
        book_name AS bookName,
        last_source AS lastSource,
        original_forms AS originalFormsJson,
        mastery_level AS masteryLevel,
        fail_count AS failCount,
        created_at AS createdAt,
        updated_at AS updatedAt,
        next_review_time AS nextReviewTime
      FROM library_entries
      WHERE id = ?
      LIMIT 1
    `,
    [id],
  );

  return row ? mapLibraryRow(row) : null;
}

async function deleteLibraryEntry(id) {
  await run(`DELETE FROM library_entries WHERE id = ?`, [id]);
}

async function updateLibraryEntryTextFields({ id, definition, exampleSentence, updatedAt }) {
  await run(
    `
      UPDATE library_entries
      SET
        definition = ?,
        example_sentence = ?,
        updated_at = ?
      WHERE id = ?
    `,
    [definition, exampleSentence, updatedAt, id],
  );

  return findLibraryEntryById(id);
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
        .map((lemma) => String(lemma || "").trim().toLowerCase())
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
  await run(
    `
      INSERT INTO library_entries (
        id, lemma, raw_word, phonetic, pos, definition, example_sentence,
        source_name, book_name, last_source, original_forms,
        mastery_level, fail_count, created_at, updated_at, next_review_time
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        lemma = excluded.lemma,
        raw_word = excluded.raw_word,
        phonetic = excluded.phonetic,
        pos = excluded.pos,
        definition = excluded.definition,
        example_sentence = excluded.example_sentence,
        source_name = excluded.source_name,
        book_name = excluded.book_name,
        last_source = excluded.last_source,
        original_forms = excluded.original_forms,
        mastery_level = excluded.mastery_level,
        fail_count = excluded.fail_count,
        updated_at = excluded.updated_at,
        next_review_time = excluded.next_review_time
    `,
    [
      entry.id,
      entry.lemma,
      entry.rawWord,
      entry.phonetic || "",
      entry.pos || "",
      entry.definition || "",
      entry.exampleSentence || "",
      entry.sourceName || "manual-input",
      entry.bookName || "未命名词书",
      entry.lastSource || entry.sourceName || "manual-input",
      JSON.stringify(entry.originalForms || [entry.rawWord || entry.lemma]),
      entry.masteryLevel || 0,
      entry.failCount || 0,
      entry.createdAt,
      entry.updatedAt,
      entry.nextReviewTime,
    ],
  );
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
      entry.sourceName || "manual-input",
      entry.bookName || "未命名词书",
      entry.mode || "normal",
      entry.llmUsed ? 1 : 0,
      entry.warning || "",
      entry.fingerprint || "",
      entry.candidateCount || 0,
    ],
  );
}

function safeJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

module.exports = {
  listLibraryEntries,
  findLibraryEntryById,
  deleteLibraryEntry,
  updateLibraryEntryTextFields,
  findDictionaryEntriesByLemma,
  findDictionaryEntriesByLemmas,
  saveLibraryEntry,
  insertParseHistory,
};
