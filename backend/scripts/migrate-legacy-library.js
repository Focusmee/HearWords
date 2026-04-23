/* eslint-disable no-console */
const { initializeDatabase, all, get, run } = require("../db");

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

function isPlaceholderDefinition(definition) {
  const text = normalizeText(definition);
  return Boolean(text && (text.includes("词典未收录") || text.includes("待手动补充")));
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

  if (b.length > a.length) return b;
  return a;
}

async function ensureBookId(name, timestamp) {
  const bookName = normalizeText(name) || DEFAULT_BOOK_NAME;
  await run(
    `
      INSERT INTO books (name, created_at, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        updated_at = CASE
          WHEN excluded.updated_at > books.updated_at THEN excluded.updated_at
          ELSE books.updated_at
        END
    `,
    [bookName, timestamp, timestamp],
  );
  const row = await get(`SELECT id FROM books WHERE name = ?`, [bookName]);
  if (!row?.id) {
    throw new Error(`Failed to resolve book id for "${bookName}"`);
  }
  return Number(row.id);
}

async function ensureWordId(word) {
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
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(lemma) DO UPDATE SET
        raw_word = excluded.raw_word,
        phonetic = excluded.phonetic,
        pos = excluded.pos,
        definition = excluded.definition,
        example_sentence = excluded.example_sentence,
        original_forms = excluded.original_forms,
        mastery_level = excluded.mastery_level,
        fail_count = excluded.fail_count,
        created_at = CASE
          WHEN excluded.created_at < words.created_at THEN excluded.created_at
          ELSE words.created_at
        END,
        updated_at = CASE
          WHEN excluded.updated_at > words.updated_at THEN excluded.updated_at
          ELSE words.updated_at
        END,
        next_review_time = CASE
          WHEN excluded.next_review_time < words.next_review_time THEN excluded.next_review_time
          ELSE words.next_review_time
        END,
        last_source = excluded.last_source
    `,
    [
      word.lemma,
      word.rawWord,
      word.phonetic,
      word.pos,
      word.definition,
      word.exampleSentence,
      JSON.stringify(word.originalForms),
      word.masteryLevel,
      word.failCount,
      word.createdAt,
      word.updatedAt,
      word.nextReviewTime,
      word.lastSource,
    ],
  );

  const row = await get(`SELECT id FROM words WHERE lemma = ?`, [word.lemma]);
  if (!row?.id) {
    throw new Error(`Failed to resolve word id for "${word.lemma}"`);
  }
  return Number(row.id);
}

async function upsertBookWordLink({ bookId, wordId, createdAt, updatedAt, lastSource }) {
  const created = Number(createdAt) || Date.now();
  const updated = Number(updatedAt) || created;
  await run(
    `
      INSERT INTO book_words (book_id, word_id, created_at, updated_at, last_source)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(book_id, word_id) DO UPDATE SET
        created_at = CASE
          WHEN excluded.created_at < book_words.created_at THEN excluded.created_at
          ELSE book_words.created_at
        END,
        updated_at = CASE
          WHEN excluded.updated_at > book_words.updated_at THEN excluded.updated_at
          ELSE book_words.updated_at
        END,
        last_source = CASE
          WHEN excluded.updated_at > book_words.updated_at THEN excluded.last_source
          ELSE book_words.last_source
        END
    `,
    [bookId, wordId, created, updated, normalizeText(lastSource)],
  );
}

async function main() {
  await initializeDatabase();

  const legacyRows = await all(
    `
      SELECT
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
    `,
  );

  if (!legacyRows.length) {
    console.log("No legacy library_entries rows found. Nothing to migrate.");
    return;
  }

  const lemmaAgg = new Map();
  const linkAgg = new Map(); // key: `${bookName}\n${lemma}`

  for (const row of legacyRows) {
    const lemma = normalizeLemma(row.lemma);
    if (!lemma) continue;

    const bookName = normalizeText(row.bookName) || DEFAULT_BOOK_NAME;
    const entryUpdatedAt = Number(row.updatedAt) || 0;
    const entryCreatedAt = Number(row.createdAt) || entryUpdatedAt || Date.now();
    const entryNextReview = Number(row.nextReviewTime) || entryUpdatedAt || Date.now();
    const entryLastSource = normalizeText(row.lastSource) || normalizeText(row.sourceName) || DEFAULT_SOURCE_NAME;

    const forms = safeJson(row.originalFormsJson, []);
    const originalForms = new Set(
      (Array.isArray(forms) ? forms : [])
        .map((value) => normalizeText(value))
        .filter(Boolean),
    );
    if (normalizeText(row.rawWord)) originalForms.add(normalizeText(row.rawWord));
    originalForms.add(lemma);

    const existing = lemmaAgg.get(lemma) || {
      lemma,
      rawWord: "",
      phonetic: "",
      pos: "",
      definition: "",
      exampleSentence: "",
      originalForms: new Set(),
      masteryLevel: 0,
      failCount: 0,
      createdAt: entryCreatedAt,
      updatedAt: entryUpdatedAt,
      nextReviewTime: entryNextReview,
      lastSource: entryLastSource,
      lastSourceUpdatedAt: entryUpdatedAt,
    };

    existing.rawWord = pickBetterText(existing.rawWord, row.rawWord);
    existing.phonetic = pickBetterText(existing.phonetic, row.phonetic);
    existing.pos = pickBetterText(existing.pos, row.pos);
    existing.definition = pickBetterText(existing.definition, row.definition, { avoidPlaceholder: true });
    existing.exampleSentence = pickBetterText(existing.exampleSentence, row.exampleSentence);
    existing.masteryLevel = Math.max(Number(existing.masteryLevel) || 0, Number(row.masteryLevel) || 0);
    existing.failCount = Math.max(Number(existing.failCount) || 0, Number(row.failCount) || 0);
    existing.createdAt = Math.min(Number(existing.createdAt) || entryCreatedAt, entryCreatedAt);
    existing.updatedAt = Math.max(Number(existing.updatedAt) || entryUpdatedAt, entryUpdatedAt);
    existing.nextReviewTime = Math.min(Number(existing.nextReviewTime) || entryNextReview, entryNextReview);

    for (const form of originalForms) {
      existing.originalForms.add(form);
    }

    if (entryUpdatedAt >= (Number(existing.lastSourceUpdatedAt) || 0)) {
      existing.lastSourceUpdatedAt = entryUpdatedAt;
      existing.lastSource = entryLastSource;
    }

    lemmaAgg.set(lemma, existing);

    const linkKey = `${bookName}\n${lemma}`;
    const existingLink = linkAgg.get(linkKey);
    if (!existingLink || entryUpdatedAt > existingLink.updatedAt) {
      linkAgg.set(linkKey, {
        bookName,
        lemma,
        createdAt: entryCreatedAt,
        updatedAt: entryUpdatedAt,
        lastSource: entryLastSource,
      });
    } else {
      existingLink.createdAt = Math.min(existingLink.createdAt, entryCreatedAt);
    }
  }

  const bookIdCache = new Map();
  const now = Date.now();
  let migratedWords = 0;
  let migratedLinks = 0;

  for (const agg of lemmaAgg.values()) {
    const wordPayload = {
      lemma: agg.lemma,
      rawWord: agg.rawWord || agg.lemma,
      phonetic: agg.phonetic || "",
      pos: agg.pos || "",
      definition: agg.definition || "",
      exampleSentence: agg.exampleSentence || "",
      originalForms: Array.from(agg.originalForms || new Set([agg.lemma])),
      masteryLevel: Number(agg.masteryLevel) || 0,
      failCount: Number(agg.failCount) || 0,
      createdAt: Number(agg.createdAt) || now,
      updatedAt: Number(agg.updatedAt) || now,
      nextReviewTime: Number(agg.nextReviewTime) || now,
      lastSource: agg.lastSource || DEFAULT_SOURCE_NAME,
    };

    await ensureWordId(wordPayload);
    migratedWords += 1;
  }

  for (const link of linkAgg.values()) {
    if (!bookIdCache.has(link.bookName)) {
      bookIdCache.set(link.bookName, await ensureBookId(link.bookName, now));
    }
    const bookId = bookIdCache.get(link.bookName);

    const wordRow = await get(`SELECT id FROM words WHERE lemma = ?`, [link.lemma]);
    if (!wordRow?.id) continue;

    await upsertBookWordLink({
      bookId,
      wordId: Number(wordRow.id),
      createdAt: link.createdAt,
      updatedAt: link.updatedAt,
      lastSource: link.lastSource,
    });
    migratedLinks += 1;
  }

  console.log(
    JSON.stringify(
      {
        legacyRows: legacyRows.length,
        words: migratedWords,
        bookLinks: migratedLinks,
        books: bookIdCache.size,
      },
      null,
      2,
    ),
  );
  console.log("Migration complete. library_entries remains unchanged as legacy/compat data.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

