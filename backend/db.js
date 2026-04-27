const path = require("node:path");
const fs = require("node:fs");
const sqlite3 = require("sqlite3").verbose();

const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "hearwords.db");

fs.mkdirSync(DATA_DIR, { recursive: true });

let database;

function getDb() {
  if (!database) {
    database = new sqlite3.Database(DB_PATH);
  }
  return database;
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row || null);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows || []);
    });
  });
}

async function exec(sql) {
  return new Promise((resolve, reject) => {
    getDb().exec(sql, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function initializeDatabase() {
  await exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS library_entries (
      id TEXT PRIMARY KEY,
      lemma TEXT NOT NULL,
      raw_word TEXT,
      phonetic TEXT,
      pos TEXT,
      definition TEXT,
      example_sentence TEXT,
      source_name TEXT,
      book_name TEXT,
      last_source TEXT,
      original_forms TEXT,
      mastery_level INTEGER DEFAULT 0,
      fail_count INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      next_review_time INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_library_lemma ON library_entries(lemma);
    CREATE INDEX IF NOT EXISTS idx_library_review ON library_entries(next_review_time);

    CREATE TABLE IF NOT EXISTS dictionary_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lemma TEXT NOT NULL,
      pos TEXT NOT NULL,
      definition TEXT NOT NULL,
      example_sentence TEXT,
      source TEXT NOT NULL,
      rank_order INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_dictionary_lemma ON dictionary_entries(lemma);

    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lemma TEXT NOT NULL UNIQUE,
      raw_word TEXT,
      phonetic TEXT,
      pos TEXT,
      definition TEXT,
      example_sentence TEXT,
      original_forms TEXT,
      mastery_level INTEGER DEFAULT 0,
      fail_count INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      next_review_time INTEGER NOT NULL,
      last_source TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_words_review ON words(next_review_time);

    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS book_words (
      book_id INTEGER NOT NULL,
      word_id INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_source TEXT,
      PRIMARY KEY (book_id, word_id),
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_book_words_book ON book_words(book_id);
    CREATE INDEX IF NOT EXISTS idx_book_words_word ON book_words(word_id);
    CREATE INDEX IF NOT EXISTS idx_book_words_updated ON book_words(word_id, updated_at);

    CREATE TABLE IF NOT EXISTS parse_history (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      source_name TEXT,
      book_name TEXT,
      mode TEXT,
      llm_used INTEGER DEFAULT 0,
      warning TEXT,
      fingerprint TEXT,
      candidate_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS app_kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS answer_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      session_id TEXT,
      word_id INTEGER NOT NULL,
      book_id INTEGER,
      book_name TEXT,
      expected_answer TEXT NOT NULL,
      user_input TEXT,
      is_correct INTEGER NOT NULL DEFAULT 0,
      is_skipped INTEGER NOT NULL DEFAULT 0,
      is_timeout INTEGER NOT NULL DEFAULT 0,
      playback_count INTEGER DEFAULT 0,
      answer_duration_ms INTEGER,
      answered_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
      FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_answer_records_user_time ON answer_records(user_id, answered_at);
    CREATE INDEX IF NOT EXISTS idx_answer_records_word_time ON answer_records(word_id, answered_at);
    CREATE INDEX IF NOT EXISTS idx_answer_records_session ON answer_records(session_id);

    CREATE TABLE IF NOT EXISTS wrong_words (
      user_id TEXT NOT NULL,
      word_id INTEGER NOT NULL,
      total_wrong_count INTEGER NOT NULL DEFAULT 0,
      consecutive_correct_count INTEGER NOT NULL DEFAULT 0,
      consecutive_wrong_count INTEGER NOT NULL DEFAULT 0,
      latest_wrong_answer TEXT,
      latest_wrong_at INTEGER,
      error_type TEXT,
      status TEXT NOT NULL DEFAULT 'to_consolidate',
      is_important INTEGER NOT NULL DEFAULT 0,
      last_answer_record_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, word_id),
      FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
      FOREIGN KEY (last_answer_record_id) REFERENCES answer_records(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_wrong_words_status ON wrong_words(user_id, status, updated_at);
    CREATE INDEX IF NOT EXISTS idx_wrong_words_latest_wrong ON wrong_words(user_id, latest_wrong_at);

    CREATE TABLE IF NOT EXISTS word_memory (
      user_id TEXT NOT NULL,
      word_id INTEGER NOT NULL,
      state TEXT NOT NULL DEFAULT 'unlearned',
      consecutive_correct_count INTEGER NOT NULL DEFAULT 0,
      consecutive_wrong_count INTEGER NOT NULL DEFAULT 0,
      last_practiced_at INTEGER,
      next_review_time INTEGER,
      review_interval_days INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, word_id),
      FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_word_memory_user_state ON word_memory(user_id, state, updated_at);
    CREATE INDEX IF NOT EXISTS idx_word_memory_user_review ON word_memory(user_id, next_review_time);
  `);

  await ensureWordsColumn("dictation_attempts", "INTEGER DEFAULT 0");
}

async function ensureWordsColumn(columnName, columnSpec) {
  const normalizedName = String(columnName || "").trim();
  const normalizedSpec = String(columnSpec || "").trim();
  if (!normalizedName || !normalizedSpec) {
    return;
  }

  const columns = await all(`PRAGMA table_info(words)`);
  const exists = columns.some((column) => String(column?.name || "").toLowerCase() === normalizedName.toLowerCase());
  if (exists) {
    return;
  }

  await exec(`ALTER TABLE words ADD COLUMN ${normalizedName} ${normalizedSpec};`);
}

async function getLibrary() {
  const rows = await all(`
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
  `);

  return rows.map((row) => {
    const { originalFormsJson, ...rest } = row;
    return {
      ...rest,
      originalForms: safeJson(originalFormsJson, [row.rawWord]),
    };
  });
}

async function upsertLibraryEntry(entry) {
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

async function deleteLibraryEntry(id) {
  await run(`DELETE FROM library_entries WHERE id = ?`, [id]);
}

async function getDictionaryEntries(lemma) {
  return all(
    `
      SELECT lemma, pos, definition, example_sentence AS exampleSentence, source, rank_order AS rankOrder
      FROM dictionary_entries
      WHERE lemma = ?
      ORDER BY rank_order ASC, pos ASC, id ASC
    `,
    [lemma],
  );
}

async function getDictionaryCount() {
  const row = await get(`SELECT COUNT(*) AS count FROM dictionary_entries`);
  return Number(row?.count || 0);
}

async function insertDictionaryEntries(entries) {
  await run("BEGIN TRANSACTION");
  try {
    for (const entry of entries) {
      await run(
        `
          INSERT INTO dictionary_entries (lemma, pos, definition, example_sentence, source, rank_order)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
        [
          entry.lemma,
          entry.pos,
          entry.definition,
          entry.exampleSentence || "",
          entry.source,
          entry.rankOrder || 0,
        ],
      );
    }
    await run("COMMIT");
  } catch (error) {
    await run("ROLLBACK");
    throw error;
  }
}

async function replaceDictionaryEntries(entries) {
  await run(`DELETE FROM dictionary_entries`);
  await insertDictionaryEntries(entries);
}

async function addParseHistory(entry) {
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

async function getParseHistory(limit = 30) {
  return all(
    `
      SELECT
        id,
        created_at AS createdAt,
        source_name AS sourceName,
        book_name AS bookName,
        mode,
        llm_used AS llmUsed,
        warning,
        fingerprint,
        candidate_count AS candidateCount
      FROM parse_history
      ORDER BY created_at DESC
      LIMIT ?
    `,
    [limit],
  );
}

async function setKv(key, value) {
  await run(
    `
      INSERT INTO app_kv (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `,
    [key, value],
  );
}

async function getKv(key) {
  const row = await get(`SELECT value FROM app_kv WHERE key = ?`, [key]);
  return row?.value || null;
}

function safeJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

module.exports = {
  DB_PATH,
  initializeDatabase,
  getLibrary,
  upsertLibraryEntry,
  deleteLibraryEntry,
  getDictionaryEntries,
  getDictionaryCount,
  insertDictionaryEntries,
  replaceDictionaryEntries,
  addParseHistory,
  getParseHistory,
  setKv,
  getKv,
  run,
  get,
  all,
};
