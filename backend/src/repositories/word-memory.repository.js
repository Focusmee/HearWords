const { all, get, run } = require("../../db");

const STATE_UNLEARNED = "unlearned";
const STATE_WEAK = "weak";
const STATE_CONSOLIDATING = "consolidating";
const STATE_MASTERED = "mastered";

const STATE_TEXT = {
  [STATE_UNLEARNED]: "未学习",
  [STATE_WEAK]: "薄弱",
  [STATE_CONSOLIDATING]: "巩固中",
  [STATE_MASTERED]: "已掌握",
};

const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeText(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

async function findMemory({ userId, wordId }) {
  const row = await get(
    `
      SELECT
        user_id AS userId,
        word_id AS wordId,
        state,
        consecutive_correct_count AS consecutiveCorrectCount,
        consecutive_wrong_count AS consecutiveWrongCount,
        last_practiced_at AS lastPracticedAt,
        next_review_time AS nextReviewTime,
        review_interval_days AS reviewIntervalDays,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM word_memory
      WHERE user_id = ? AND word_id = ?
      LIMIT 1
    `,
    [normalizeText(userId) || "local", Number(wordId)],
  );

  return row ? mapMemoryRow(row) : null;
}

async function listMemories({ userId } = {}) {
  const rows = await all(
    `
      SELECT
        user_id AS userId,
        word_id AS wordId,
        state,
        consecutive_correct_count AS consecutiveCorrectCount,
        consecutive_wrong_count AS consecutiveWrongCount,
        last_practiced_at AS lastPracticedAt,
        next_review_time AS nextReviewTime,
        review_interval_days AS reviewIntervalDays,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM word_memory
      WHERE user_id = ?
      ORDER BY next_review_time ASC, updated_at DESC
    `,
    [normalizeText(userId) || "local"],
  );

  return rows.map(mapMemoryRow);
}

async function recordPractice({ userId, wordId, isCorrect, isSkipped, answeredAt }) {
  const normalizedUserId = normalizeText(userId) || "local";
  const normalizedWordId = Number(wordId);
  if (!normalizedWordId) {
    throw new Error("Missing wordId for word memory update");
  }

  const now = Date.now();
  const timestamp = Number(answeredAt) || now;
  const existing = await findMemory({ userId: normalizedUserId, wordId: normalizedWordId });
  const correct = Boolean(isCorrect) && !isSkipped;
  const next = buildNextMemoryState({ existing, isCorrect: correct, answeredAt: timestamp });

  if (!existing) {
    await run(
      `
        INSERT INTO word_memory (
          user_id,
          word_id,
          state,
          consecutive_correct_count,
          consecutive_wrong_count,
          last_practiced_at,
          next_review_time,
          review_interval_days,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        normalizedUserId,
        normalizedWordId,
        next.state,
        next.consecutiveCorrectCount,
        next.consecutiveWrongCount,
        timestamp,
        next.nextReviewTime,
        next.reviewIntervalDays,
        now,
        now,
      ],
    );
    return findMemory({ userId: normalizedUserId, wordId: normalizedWordId });
  }

  await run(
    `
      UPDATE word_memory
      SET
        state = ?,
        consecutive_correct_count = ?,
        consecutive_wrong_count = ?,
        last_practiced_at = ?,
        next_review_time = ?,
        review_interval_days = ?,
        updated_at = ?
      WHERE user_id = ? AND word_id = ?
    `,
    [
      next.state,
      next.consecutiveCorrectCount,
      next.consecutiveWrongCount,
      timestamp,
      next.nextReviewTime,
      next.reviewIntervalDays,
      now,
      normalizedUserId,
      normalizedWordId,
    ],
  );

  return findMemory({ userId: normalizedUserId, wordId: normalizedWordId });
}

function buildNextMemoryState({ existing, isCorrect, answeredAt }) {
  if (!isCorrect) {
    return {
      state: STATE_WEAK,
      consecutiveCorrectCount: 0,
      consecutiveWrongCount: Number(existing?.consecutiveWrongCount || 0) + 1,
      reviewIntervalDays: 1,
      nextReviewTime: answeredAt + DAY_MS,
    };
  }

  const previousState = existing?.state || STATE_UNLEARNED;
  const consecutiveCorrectCount = Number(existing?.consecutiveCorrectCount || 0) + 1;
  let reviewIntervalDays = 1;
  let state = STATE_CONSOLIDATING;

  if (previousState === STATE_MASTERED) {
    state = STATE_MASTERED;
    reviewIntervalDays = Math.max(14, Number(existing?.reviewIntervalDays || 0) * 2 || 14);
  } else if (consecutiveCorrectCount >= 3) {
    state = STATE_MASTERED;
    reviewIntervalDays = 7;
  } else if (consecutiveCorrectCount >= 2) {
    reviewIntervalDays = 3;
  }

  return {
    state,
    consecutiveCorrectCount,
    consecutiveWrongCount: 0,
    reviewIntervalDays,
    nextReviewTime: answeredAt + reviewIntervalDays * DAY_MS,
  };
}

function mapMemoryRow(row) {
  const state = normalizeState(row.state);
  return {
    ...row,
    wordId: Number(row.wordId),
    state,
    stateText: STATE_TEXT[state] || STATE_TEXT[STATE_UNLEARNED],
    consecutiveCorrectCount: Number(row.consecutiveCorrectCount) || 0,
    consecutiveWrongCount: Number(row.consecutiveWrongCount) || 0,
    lastPracticedAt: Number(row.lastPracticedAt) || 0,
    nextReviewTime: Number(row.nextReviewTime) || 0,
    reviewIntervalDays: Number(row.reviewIntervalDays) || 0,
    createdAt: Number(row.createdAt) || 0,
    updatedAt: Number(row.updatedAt) || 0,
  };
}

function normalizeState(state) {
  const text = normalizeText(state);
  const valid = new Set([STATE_UNLEARNED, STATE_WEAK, STATE_CONSOLIDATING, STATE_MASTERED]);
  return valid.has(text) ? text : STATE_UNLEARNED;
}

module.exports = {
  STATE_UNLEARNED,
  STATE_WEAK,
  STATE_CONSOLIDATING,
  STATE_MASTERED,
  STATE_TEXT,
  findMemory,
  listMemories,
  recordPractice,
};
