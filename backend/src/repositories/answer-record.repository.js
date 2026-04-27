const { randomUUID } = require("node:crypto");
const { all, run } = require("../../db");

function normalizeText(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

async function createAnswerRecord(record) {
  const now = Date.now();
  const id = normalizeText(record?.id) || randomUUID();
  const userId = normalizeText(record?.userId) || "local";
  const wordId = Number(record?.wordId);

  if (!wordId) {
    throw new Error("Missing wordId for answer record");
  }

  await run(
    `
      INSERT INTO answer_records (
        id,
        user_id,
        session_id,
        word_id,
        book_id,
        book_name,
        expected_answer,
        user_input,
        is_correct,
        is_skipped,
        is_timeout,
        playback_count,
        answer_duration_ms,
        answered_at,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      userId,
      normalizeText(record?.sessionId) || null,
      wordId,
      Number(record?.bookId) || null,
      normalizeText(record?.bookName) || null,
      normalizeText(record?.expectedAnswer),
      typeof record?.userInput === "string" ? record.userInput : "",
      record?.isCorrect ? 1 : 0,
      record?.isSkipped ? 1 : 0,
      record?.isTimeout ? 1 : 0,
      Number(record?.playbackCount) || 0,
      Number.isFinite(Number(record?.answerDurationMs)) ? Number(record.answerDurationMs) : null,
      Number(record?.answeredAt) || now,
      now,
    ],
  );

  return { id };
}

async function listAnswerRecords({ userId, since, until, limit } = {}) {
  const normalizedUserId = normalizeText(userId) || "local";
  const params = [normalizedUserId];
  const where = ["ar.user_id = ?"];

  if (Number(since)) {
    where.push("ar.answered_at >= ?");
    params.push(Number(since));
  }
  if (Number(until)) {
    where.push("ar.answered_at < ?");
    params.push(Number(until));
  }

  const normalizedLimit = Math.min(5000, Math.max(1, Number(limit) || 1000));
  params.push(normalizedLimit);

  const rows = await all(
    `
      SELECT
        ar.id,
        ar.user_id AS userId,
        ar.session_id AS sessionId,
        ar.word_id AS wordId,
        ar.book_id AS bookId,
        ar.book_name AS bookName,
        ar.expected_answer AS expectedAnswer,
        ar.user_input AS userInput,
        ar.is_correct AS isCorrect,
        ar.is_skipped AS isSkipped,
        ar.is_timeout AS isTimeout,
        ar.playback_count AS playbackCount,
        ar.answer_duration_ms AS answerDurationMs,
        ar.answered_at AS answeredAt,
        ar.created_at AS createdAt,
        w.lemma,
        w.definition
      FROM answer_records ar
      JOIN words w ON w.id = ar.word_id
      WHERE ${where.join(" AND ")}
      ORDER BY ar.answered_at DESC
      LIMIT ?
    `,
    params,
  );

  return rows.map(mapAnswerRecordRow);
}

function mapAnswerRecordRow(row) {
  return {
    ...row,
    wordId: Number(row.wordId),
    bookId: Number(row.bookId) || null,
    isCorrect: Boolean(row.isCorrect),
    isSkipped: Boolean(row.isSkipped),
    isTimeout: Boolean(row.isTimeout),
    playbackCount: Number(row.playbackCount) || 0,
    answerDurationMs: Number(row.answerDurationMs) || 0,
    answeredAt: Number(row.answeredAt) || 0,
    createdAt: Number(row.createdAt) || 0,
  };
}

module.exports = {
  createAnswerRecord,
  listAnswerRecords,
};
