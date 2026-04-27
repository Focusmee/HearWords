const { all, get, run } = require("../../db");

const STATUS_TO_CONSOLIDATE = "to_consolidate";
const STATUS_IMPORTANT_REVIEW = "important_review";
const STATUS_RECOVERING = "recovering";
const STATUS_MASTERED = "mastered";

function normalizeText(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

async function recordWrongAttempt({ userId, wordId, wrongAnswer, answeredAt, errorType, answerRecordId }) {
  const normalizedUserId = normalizeText(userId) || "local";
  const normalizedWordId = Number(wordId);
  const now = Date.now();
  const timestamp = Number(answeredAt) || now;

  if (!normalizedWordId) {
    throw new Error("Missing wordId for wrong word update");
  }

  const existing = await findWrongWord({ userId: normalizedUserId, wordId: normalizedWordId });
  if (!existing) {
    await run(
      `
        INSERT INTO wrong_words (
          user_id,
          word_id,
          total_wrong_count,
          consecutive_correct_count,
          consecutive_wrong_count,
          latest_wrong_answer,
          latest_wrong_at,
          error_type,
          status,
          is_important,
          last_answer_record_id,
          created_at,
          updated_at
        )
        VALUES (?, ?, 1, 0, 1, ?, ?, ?, ?, 0, ?, ?, ?)
      `,
      [
        normalizedUserId,
        normalizedWordId,
        normalizeText(wrongAnswer),
        timestamp,
        normalizeText(errorType) || "other",
        STATUS_TO_CONSOLIDATE,
        normalizeText(answerRecordId) || null,
        now,
        now,
      ],
    );
    return findWrongWord({ userId: normalizedUserId, wordId: normalizedWordId });
  }

  const nextWrongCount = Number(existing.totalWrongCount || 0) + 1;
  const nextConsecutiveWrongCount = Number(existing.consecutiveWrongCount || 0) + 1;
  const nextStatus = existing.isImportant || nextWrongCount >= 3
    ? STATUS_IMPORTANT_REVIEW
    : STATUS_TO_CONSOLIDATE;

  await run(
    `
      UPDATE wrong_words
      SET
        total_wrong_count = ?,
        consecutive_correct_count = 0,
        consecutive_wrong_count = ?,
        latest_wrong_answer = ?,
        latest_wrong_at = ?,
        error_type = ?,
        status = ?,
        last_answer_record_id = ?,
        updated_at = ?
      WHERE user_id = ? AND word_id = ?
    `,
    [
      nextWrongCount,
      nextConsecutiveWrongCount,
      normalizeText(wrongAnswer),
      timestamp,
      normalizeText(errorType) || "other",
      nextStatus,
      normalizeText(answerRecordId) || null,
      now,
      normalizedUserId,
      normalizedWordId,
    ],
  );

  return findWrongWord({ userId: normalizedUserId, wordId: normalizedWordId });
}

async function recordCorrectAttempt({ userId, wordId, answeredAt, answerRecordId }) {
  const normalizedUserId = normalizeText(userId) || "local";
  const normalizedWordId = Number(wordId);
  const now = Date.now();

  if (!normalizedWordId) {
    throw new Error("Missing wordId for wrong word recovery update");
  }

  const existing = await findWrongWord({ userId: normalizedUserId, wordId: normalizedWordId });
  if (!existing) {
    return null;
  }

  const nextConsecutiveCorrectCount = Number(existing.consecutiveCorrectCount || 0) + 1;
  let nextStatus = existing.status || STATUS_TO_CONSOLIDATE;
  if (nextConsecutiveCorrectCount >= 3) {
    nextStatus = STATUS_MASTERED;
  } else if (nextConsecutiveCorrectCount >= 2) {
    nextStatus = STATUS_RECOVERING;
  }

  await run(
    `
      UPDATE wrong_words
      SET
        consecutive_correct_count = ?,
        consecutive_wrong_count = 0,
        status = ?,
        last_answer_record_id = ?,
        updated_at = ?
      WHERE user_id = ? AND word_id = ?
    `,
    [
      nextConsecutiveCorrectCount,
      nextStatus,
      normalizeText(answerRecordId) || null,
      Number(answeredAt) || now,
      normalizedUserId,
      normalizedWordId,
    ],
  );

  return findWrongWord({ userId: normalizedUserId, wordId: normalizedWordId });
}

async function listWrongWords({ userId, status } = {}) {
  const normalizedUserId = normalizeText(userId) || "local";
  const normalizedStatus = normalizeStatus(status);
  const params = [normalizedUserId];
  const where = ["ww.user_id = ?"];

  if (normalizedStatus) {
    where.push("ww.status = ?");
    params.push(normalizedStatus);
  }

  const rows = await all(
    `
      SELECT
        ww.user_id AS userId,
        ww.word_id AS wordId,
        ww.total_wrong_count AS totalWrongCount,
        ww.consecutive_correct_count AS consecutiveCorrectCount,
        ww.consecutive_wrong_count AS consecutiveWrongCount,
        ww.latest_wrong_answer AS latestWrongAnswer,
        ww.latest_wrong_at AS latestWrongAt,
        ww.error_type AS errorType,
        ww.status,
        ww.is_important AS isImportant,
        ww.last_answer_record_id AS lastAnswerRecordId,
        ww.created_at AS createdAt,
        ww.updated_at AS updatedAt,
        w.lemma,
        w.raw_word AS rawWord,
        w.phonetic,
        w.pos,
        w.definition,
        w.example_sentence AS exampleSentence
      FROM wrong_words ww
      JOIN words w ON w.id = ww.word_id
      WHERE ${where.join(" AND ")}
      ORDER BY
        CASE
          WHEN ww.status = '${STATUS_IMPORTANT_REVIEW}' THEN 0
          WHEN ww.status = '${STATUS_TO_CONSOLIDATE}' THEN 1
          WHEN ww.status = '${STATUS_RECOVERING}' THEN 2
          WHEN ww.status = '${STATUS_MASTERED}' THEN 3
          ELSE 4
        END,
        ww.is_important DESC,
        ww.total_wrong_count DESC,
        ww.latest_wrong_at DESC,
        w.lemma ASC
    `,
    params,
  );

  return rows.map(mapWrongWordRow);
}

async function getWrongWordStats({ userId } = {}) {
  const normalizedUserId = normalizeText(userId) || "local";
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const row = await get(
    `
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status != ? THEN 1 ELSE 0 END) AS currentCount,
        SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) AS newTodayCount,
        SUM(CASE WHEN status = ? OR is_important = 1 THEN 1 ELSE 0 END) AS importantReviewCount,
        SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS masteredCount,
        SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS toConsolidateCount,
        SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS recoveringCount
      FROM wrong_words
      WHERE user_id = ?
    `,
    [
      STATUS_MASTERED,
      startOfDay.getTime(),
      STATUS_IMPORTANT_REVIEW,
      STATUS_MASTERED,
      STATUS_TO_CONSOLIDATE,
      STATUS_RECOVERING,
      normalizedUserId,
    ],
  );

  return {
    total: Number(row?.total) || 0,
    currentCount: Number(row?.currentCount) || 0,
    newTodayCount: Number(row?.newTodayCount) || 0,
    importantReviewCount: Number(row?.importantReviewCount) || 0,
    masteredCount: Number(row?.masteredCount) || 0,
    toConsolidateCount: Number(row?.toConsolidateCount) || 0,
    recoveringCount: Number(row?.recoveringCount) || 0,
  };
}

async function setImportant({ userId, wordId, important }) {
  const normalizedUserId = normalizeText(userId) || "local";
  const normalizedWordId = Number(wordId);
  if (!normalizedWordId) {
    throw new Error("Missing wordId for wrong word importance update");
  }

  const now = Date.now();
  const nextImportant = important ? 1 : 0;
  const nextStatus = nextImportant ? STATUS_IMPORTANT_REVIEW : STATUS_TO_CONSOLIDATE;

  await run(
    `
      UPDATE wrong_words
      SET
        is_important = ?,
        status = CASE
          WHEN status = ? THEN status
          WHEN ? = 1 THEN ?
          ELSE ?
        END,
        updated_at = ?
      WHERE user_id = ? AND word_id = ?
    `,
    [
      nextImportant,
      STATUS_MASTERED,
      nextImportant,
      STATUS_IMPORTANT_REVIEW,
      nextStatus,
      now,
      normalizedUserId,
      normalizedWordId,
    ],
  );

  return findWrongWord({ userId: normalizedUserId, wordId: normalizedWordId });
}

async function markMastered({ userId, wordId }) {
  const normalizedUserId = normalizeText(userId) || "local";
  const normalizedWordId = Number(wordId);
  if (!normalizedWordId) {
    throw new Error("Missing wordId for wrong word mastered update");
  }

  await run(
    `
      UPDATE wrong_words
      SET
        status = ?,
        consecutive_correct_count = CASE
          WHEN consecutive_correct_count < 3 THEN 3
          ELSE consecutive_correct_count
        END,
        consecutive_wrong_count = 0,
        updated_at = ?
      WHERE user_id = ? AND word_id = ?
    `,
    [STATUS_MASTERED, Date.now(), normalizedUserId, normalizedWordId],
  );

  return findWrongWord({ userId: normalizedUserId, wordId: normalizedWordId });
}

async function findWrongWord({ userId, wordId }) {
  const row = await get(
    `
      SELECT
        user_id AS userId,
        word_id AS wordId,
        total_wrong_count AS totalWrongCount,
        consecutive_correct_count AS consecutiveCorrectCount,
        consecutive_wrong_count AS consecutiveWrongCount,
        latest_wrong_answer AS latestWrongAnswer,
        latest_wrong_at AS latestWrongAt,
        error_type AS errorType,
        status,
        is_important AS isImportant,
        last_answer_record_id AS lastAnswerRecordId,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM wrong_words
      WHERE user_id = ? AND word_id = ?
      LIMIT 1
    `,
    [normalizeText(userId) || "local", Number(wordId)],
  );

  if (!row) return null;
  return mapWrongWordRow(row);
}

function mapWrongWordRow(row) {
  return {
    ...row,
    wordId: Number(row.wordId),
    totalWrongCount: Number(row.totalWrongCount) || 0,
    consecutiveCorrectCount: Number(row.consecutiveCorrectCount) || 0,
    consecutiveWrongCount: Number(row.consecutiveWrongCount) || 0,
    latestWrongAt: Number(row.latestWrongAt) || 0,
    isImportant: Boolean(row.isImportant),
    createdAt: Number(row.createdAt) || 0,
    updatedAt: Number(row.updatedAt) || 0,
  };
}

function normalizeStatus(status) {
  const text = normalizeText(status);
  const valid = new Set([
    STATUS_TO_CONSOLIDATE,
    STATUS_IMPORTANT_REVIEW,
    STATUS_RECOVERING,
    STATUS_MASTERED,
  ]);
  return valid.has(text) ? text : "";
}

module.exports = {
  STATUS_TO_CONSOLIDATE,
  STATUS_IMPORTANT_REVIEW,
  STATUS_RECOVERING,
  STATUS_MASTERED,
  recordWrongAttempt,
  recordCorrectAttempt,
  listWrongWords,
  getWrongWordStats,
  setImportant,
  markMastered,
  findWrongWord,
};
