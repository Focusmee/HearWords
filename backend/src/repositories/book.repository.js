const { all, get, run } = require("../../db");

const DEFAULT_BOOK_NAME = "未命名词书";
const DEFAULT_SOURCE_NAME = "manual-input";

function normalizeText(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

async function ensureBook({ name }) {
  const normalized = normalizeText(name) || DEFAULT_BOOK_NAME;
  const now = Date.now();

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
    [normalized, now, now],
  );

  const row = await get(`SELECT id, name FROM books WHERE name = ?`, [normalized]);
  return row ? { id: Number(row.id), name: row.name } : null;
}

async function findBookByName(name) {
  const normalized = normalizeText(name);
  if (!normalized) return null;
  const row = await get(`SELECT id, name FROM books WHERE name = ?`, [normalized]);
  return row ? { id: Number(row.id), name: row.name } : null;
}

async function listLibraryBooks() {
  const books = await all(`SELECT id, name FROM books ORDER BY name ASC`);
  const sources = await all(
    `
      SELECT
        bw.book_id AS bookId,
        bw.last_source AS sourceName
      FROM book_words bw
      WHERE bw.last_source IS NOT NULL AND TRIM(bw.last_source) != ''
    `,
  );

  const map = new Map(); // bookId -> Set(sources)
  for (const row of sources) {
    const bookId = Number(row.bookId);
    if (!bookId) continue;
    if (!map.has(bookId)) map.set(bookId, new Set());
    map.get(bookId).add(normalizeText(row.sourceName));
  }

  const items = [];
  for (const book of books) {
    const bookName = book.name || DEFAULT_BOOK_NAME;
    const sourceSet = map.get(Number(book.id)) || new Set();
    if (!sourceSet.size) {
      sourceSet.add(DEFAULT_SOURCE_NAME);
    }
    for (const sourceName of sourceSet) {
      const normalizedSource = normalizeText(sourceName) || DEFAULT_SOURCE_NAME;
      items.push({
        key: `${bookName}|${normalizedSource}`,
        bookName,
        sourceName: normalizedSource,
      });
    }
  }

  return items.sort((a, b) => {
    if (a.bookName !== b.bookName) return a.bookName.localeCompare(b.bookName);
    return a.sourceName.localeCompare(b.sourceName);
  });
}

async function listBooks() {
  const rows = await all(
    `
      SELECT
        b.id,
        b.name,
        b.created_at AS createdAt,
        b.updated_at AS updatedAt,
        COUNT(bw.word_id) AS wordCount
      FROM books b
      LEFT JOIN book_words bw ON bw.book_id = b.id
      GROUP BY b.id
      ORDER BY b.name ASC
    `,
  );

  return rows.map((row) => ({
    id: Number(row.id),
    name: row.name,
    createdAt: Number(row.createdAt) || 0,
    updatedAt: Number(row.updatedAt) || 0,
    wordCount: Number(row.wordCount) || 0,
  }));
}

async function addWordsToBook({ bookId, wordIds, sourceName }) {
  const normalizedBookId = Number(bookId);
  const normalizedWordIds = Array.from(
    new Set((Array.isArray(wordIds) ? wordIds : []).map((id) => Number(id)).filter((id) => id > 0)),
  );
  if (!normalizedBookId || !normalizedWordIds.length) {
    return { addedLinks: 0, skippedLinks: 0, duplicates: [] };
  }

  const now = Date.now();
  const src = normalizeText(sourceName) || "library-add";
  let addedLinks = 0;
  let skippedLinks = 0;
  const duplicates = [];

  for (const wordId of normalizedWordIds) {
    const inserted = await run(
      `
        INSERT OR IGNORE INTO book_words (book_id, word_id, created_at, updated_at, last_source)
        VALUES (?, ?, ?, ?, ?)
      `,
      [normalizedBookId, wordId, now, now, src],
    );
    if (inserted?.changes) {
      addedLinks += 1;
    } else {
      skippedLinks += 1;
      if (duplicates.length < 50) {
        duplicates.push(wordId);
      }
    }

    await run(
      `
        UPDATE book_words
        SET
          updated_at = ?,
          last_source = ?
        WHERE book_id = ? AND word_id = ?
      `,
      [now, src, normalizedBookId, wordId],
    );
  }

  await run(
    `
      UPDATE books
      SET updated_at = ?
      WHERE id = ?
    `,
    [now, normalizedBookId],
  );

  return { addedLinks, skippedLinks, duplicates };
}

async function ensureBookWordLink({ bookId, wordId, sourceName }) {
  const normalizedBookId = Number(bookId);
  const normalizedWordId = Number(wordId);
  if (!normalizedBookId || !normalizedWordId) {
    return { created: false };
  }

  const now = Date.now();
  const src = normalizeText(sourceName) || DEFAULT_SOURCE_NAME;

  const insertResult = await run(
    `
      INSERT OR IGNORE INTO book_words (book_id, word_id, created_at, updated_at, last_source)
      VALUES (?, ?, ?, ?, ?)
    `,
    [normalizedBookId, normalizedWordId, now, now, src],
  );
  const created = Boolean(insertResult?.changes);

  await run(
    `
      UPDATE book_words
      SET
        updated_at = ?,
        last_source = ?
      WHERE book_id = ? AND word_id = ?
    `,
    [now, src, normalizedBookId, normalizedWordId],
  );

  await run(
    `
      UPDATE books
      SET updated_at = ?
      WHERE id = ?
    `,
    [now, normalizedBookId],
  );

  return { created };
}

async function removeWordsFromBook({ bookId, wordIds }) {
  const normalizedBookId = Number(bookId);
  const normalizedWordIds = Array.from(
    new Set((Array.isArray(wordIds) ? wordIds : []).map((id) => Number(id)).filter((id) => id > 0)),
  );
  if (!normalizedBookId || !normalizedWordIds.length) {
    return { removedLinks: 0 };
  }

  const placeholders = normalizedWordIds.map(() => "?").join(", ");
  const result = await run(
    `
      DELETE FROM book_words
      WHERE book_id = ? AND word_id IN (${placeholders})
    `,
    [normalizedBookId, ...normalizedWordIds],
  );

  await run(
    `
      UPDATE books
      SET updated_at = ?
      WHERE id = ?
    `,
    [Date.now(), normalizedBookId],
  );

  return { removedLinks: Number(result?.changes) || 0 };
}

async function deleteBook(bookId) {
  const normalizedBookId = Number(bookId);
  if (!normalizedBookId) {
    return { removedBook: 0, removedLinks: 0 };
  }

  const links = await run(
    `
      DELETE FROM book_words
      WHERE book_id = ?
    `,
    [normalizedBookId],
  );

  const book = await run(
    `
      DELETE FROM books
      WHERE id = ?
    `,
    [normalizedBookId],
  );

  return {
    removedBook: Number(book?.changes) || 0,
    removedLinks: Number(links?.changes) || 0,
  };
}

module.exports = {
  ensureBook,
  findBookByName,
  listLibraryBooks,
  listBooks,
  addWordsToBook,
  ensureBookWordLink,
  removeWordsFromBook,
  deleteBook,
};
