const { randomUUID } = require("node:crypto");

const REVIEW_STEPS = [
  10 * 60 * 1000,
  60 * 60 * 1000,
  8 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
  3 * 24 * 60 * 60 * 1000,
  7 * 24 * 60 * 60 * 1000,
];

// MVP placeholder until HearWords has real user accounts.
const DEFAULT_USER_ID = "local";

const TASK_LABEL_TEXT = {
  new: "新词",
  review: "复习",
  wrong_word: "错词",
  important: "重点",
};

const VALID_TASK_LABELS = new Set(Object.keys(TASK_LABEL_TEXT));

function createDictationService({
  dictationSessionRepository,
  dictationSelectionRepository,
  wordRepository,
  answerRecordRepository,
  wrongWordRepository,
  wordMemoryRepository,
}) {
  return {
    async startSession({ scope, includedBookNames, bookNames, wordIds, taskItems } = {}) {
      const normalizedScope = normalizeScope(scope);
      const selectionInput = normalizeSelectionInput({ includedBookNames, bookNames, wordIds, taskItems });
      const hasSelection =
        selectionInput.includedBookNames.length ||
        selectionInput.wordIds.length ||
        selectionInput.taskItems.length;

      if (hasSelection) {
        await dictationSelectionRepository.setSelection(selectionInput);
      }

      const library = await enrichLibraryWithMemoryState(await wordRepository.listLibraryEntries(), wordMemoryRepository);
      const queue = hasSelection
        ? buildSelectedQueue(library, selectionInput)
        : library.map((item) => item.id);

      const taskMeta = buildTaskMetaByWordId(selectionInput.taskItems);
      const session = queue.length
        ? {
            id: createSessionId(),
            queue,
            index: 0,
            scope: normalizedScope,
            updatedAt: Date.now(),
            ...taskMeta,
          }
        : emptySession();

      await saveSession(dictationSessionRepository, session);
      const selection = await dictationSelectionRepository.getSelection();

      const hasValidSelection = selection.includedBookNames.length || selection.wordIds.length;

      return {
        message: queue.length
          ? "已开始新的听写轮次。"
          : hasSelection
            ? "选中的单词为空。"
            : "单词书还是空的。",
        finished: !queue.length,
        session,
        current: queue.length ? getCurrentSessionWord(library, session) : null,
        selection: hasValidSelection
          ? {
              ...selection,
              bookNames: selection.includedBookNames,
            }
          : { includedBookNames: [], bookNames: [], wordIds: [], updatedAt: 0 },
      };
    },

    async getSession() {
      const session = await readSession(dictationSessionRepository);
      const library = await enrichLibraryWithMemoryState(await wordRepository.listLibraryEntries(), wordMemoryRepository);
      const current = getCurrentSessionWord(library, session);
      const selection = await dictationSelectionRepository.getSelection();
      return {
        finished: !current,
        session,
        current,
        message: current ? "已恢复听写进度。" : "当前没有进行中的听写轮次。",
        selection: {
          ...selection,
          bookNames: selection.includedBookNames,
        },
      };
    },

    async resetSession() {
      const session = emptySession();
      await saveSession(dictationSessionRepository, session);
      const selection = await dictationSelectionRepository.getSelection();
      return {
        message: "听写进度已重置。",
        finished: true,
        session,
        current: null,
        selection: {
          ...selection,
          bookNames: selection.includedBookNames,
        },
      };
    },

    async checkAnswer({ answer, answerDurationMs } = {}) {
      const rawAnswer = String(answer || "");
      const normalizedAnswer = rawAnswer.trim().toLowerCase();
      const session = await readSession(dictationSessionRepository);
      const library = await enrichLibraryWithMemoryState(await wordRepository.listLibraryEntries(), wordMemoryRepository);
      const current = getCurrentSessionWord(library, session);
      const answeredAt = Date.now();

      if (!current) {
        throw createHttpError(400, "当前没有进行中的听写。");
      }
      if (!normalizedAnswer) {
        const answerRecord = await saveAnswerRecord(answerRecordRepository, {
          session,
          current,
          userInput: rawAnswer,
          isCorrect: false,
          isSkipped: false,
          answeredAt,
          answerDurationMs,
        });
        await updateWrongWordFromAnswer(wrongWordRepository, {
          current,
          userInput: rawAnswer,
          isCorrect: false,
          isSkipped: false,
          answeredAt,
          answerRecordId: answerRecord.id,
        });
        await updateMemoryFromAnswer(wordMemoryRepository, {
          current,
          isCorrect: false,
          isSkipped: false,
          answeredAt,
        });
        throw createHttpError(400, "请输入答案。");
      }

      current.dictationAttempts = Number(current.dictationAttempts || 0) + 1;
      const correct = normalizedAnswer === String(current.lemma || "").toLowerCase();
      const answerRecord = await saveAnswerRecord(answerRecordRepository, {
        session,
        current,
        userInput: rawAnswer,
        isCorrect: correct,
        isSkipped: false,
        answeredAt,
        answerDurationMs,
      });
      await updateWrongWordFromAnswer(wrongWordRepository, {
        current,
        userInput: rawAnswer,
        isCorrect: correct,
        isSkipped: false,
        answeredAt,
        answerRecordId: answerRecord.id,
      });
      await updateMemoryFromAnswer(wordMemoryRepository, {
        current,
        isCorrect: correct,
        isSkipped: false,
        answeredAt,
      });
      if (correct) {
        const nextLevel = Math.min(5, Number(current.masteryLevel || 0) + 1);
        current.masteryLevel = nextLevel;
        current.nextReviewTime = answeredAt + REVIEW_STEPS[Math.max(0, nextLevel - 1)];
        current.updatedAt = answeredAt;
        await wordRepository.saveLibraryEntry(current);

        session.index += 1;
        session.updatedAt = answeredAt;
        const normalizedSession = normalizeSession(session);
        await saveSession(dictationSessionRepository, normalizedSession);

        const nextLibrary = await enrichLibraryWithMemoryState(await wordRepository.listLibraryEntries(), wordMemoryRepository);
        const nextWord = getCurrentSessionWord(nextLibrary, normalizedSession);
        return {
          correct: true,
          expected: current.lemma,
          diff: current.lemma,
          finished: !nextWord,
          current: nextWord,
          session: normalizedSession,
          stats: buildStats(nextLibrary),
        };
      }

      current.failCount = Number(current.failCount || 0) + 1;
      current.masteryLevel = Math.max(0, Number(current.masteryLevel || 0) - 1);
      current.nextReviewTime = answeredAt + REVIEW_STEPS[0];
      current.updatedAt = answeredAt;
      await wordRepository.saveLibraryEntry(current);

      const nextLibrary = await enrichLibraryWithMemoryState(await wordRepository.listLibraryEntries(), wordMemoryRepository);
      const updatedCurrent = getCurrentSessionWord(nextLibrary, session) || current;
      return {
        correct: false,
        expected: current.lemma,
        diff: buildDiff(normalizedAnswer, current.lemma),
        finished: false,
        current: updatedCurrent,
        session,
        stats: buildStats(nextLibrary),
      };
    },

    async skipCurrent({ answerDurationMs } = {}) {
      const session = await readSession(dictationSessionRepository);
      const library = await enrichLibraryWithMemoryState(await wordRepository.listLibraryEntries(), wordMemoryRepository);
      const current = getCurrentSessionWord(library, session);
      const answeredAt = Date.now();

      if (!current) {
        throw createHttpError(400, "当前没有进行中的听写。");
      }

      const answerRecord = await saveAnswerRecord(answerRecordRepository, {
        session,
        current,
        userInput: "",
        isCorrect: false,
        isSkipped: true,
        answeredAt,
        answerDurationMs,
      });
      await updateWrongWordFromAnswer(wrongWordRepository, {
        current,
        userInput: "",
        isCorrect: false,
        isSkipped: true,
        answeredAt,
        answerRecordId: answerRecord.id,
      });
      await updateMemoryFromAnswer(wordMemoryRepository, {
        current,
        isCorrect: false,
        isSkipped: true,
        answeredAt,
      });

      current.dictationAttempts = Number(current.dictationAttempts || 0) + 1;
      current.failCount = Number(current.failCount || 0) + 1;
      current.nextReviewTime = answeredAt + REVIEW_STEPS[0];
      current.updatedAt = answeredAt;
      await wordRepository.saveLibraryEntry(current);

      session.index += 1;
      session.updatedAt = answeredAt;
      const normalizedSession = normalizeSession(session);
      await saveSession(dictationSessionRepository, normalizedSession);
      const nextLibrary = await enrichLibraryWithMemoryState(await wordRepository.listLibraryEntries(), wordMemoryRepository);
      const nextWord = getCurrentSessionWord(nextLibrary, normalizedSession);

      return {
        message: "已跳过当前单词。",
        finished: !nextWord,
        current: nextWord,
        session: normalizedSession,
        stats: buildStats(nextLibrary),
      };
    },
  };
}

function normalizeSelectionInput({ includedBookNames, bookNames, wordIds, taskItems } = {}) {
  const normalizedTaskItems = normalizeTaskItems(taskItems);
  const explicitWordIds = Array.from(
    new Set((Array.isArray(wordIds) ? wordIds : []).map((id) => Number(id)).filter((id) => id > 0)),
  );
  return {
    includedBookNames: Array.from(
      new Set(
        (Array.isArray(bookNames) ? bookNames : []).concat(Array.isArray(includedBookNames) ? includedBookNames : [])
          .map((value) => String(value || "").trim())
          .filter(Boolean),
      ),
    ),
    wordIds: explicitWordIds.length ? explicitWordIds : normalizedTaskItems.map((item) => item.wordId),
    taskItems: normalizedTaskItems,
  };
}

function normalizeScope(scope) {
  const text = String(scope || "").trim();
  return text || "all";
}

function normalizeTaskItems(taskItems) {
  if (!Array.isArray(taskItems)) return [];
  const seen = new Set();
  const output = [];
  for (const item of taskItems) {
    const wordId = Number(item?.wordId || item?.id);
    if (!wordId || seen.has(wordId)) continue;
    seen.add(wordId);
    output.push({
      wordId,
      labels: normalizeTaskLabels(item?.labels || item?.taskLabels),
      reasonCodes: normalizeReasonCodes(item?.reasonCodes),
    });
  }
  return output;
}

function normalizeTaskLabels(value) {
  return Array.from(
    new Set((Array.isArray(value) ? value : []).map((label) => String(label || "").trim()).filter((label) => VALID_TASK_LABELS.has(label))),
  );
}

function normalizeReasonCodes(value) {
  return Array.from(
    new Set((Array.isArray(value) ? value : []).map((reason) => String(reason || "").trim()).filter(Boolean)),
  );
}

function buildTaskMetaByWordId(taskItems) {
  const taskLabelsByWordId = {};
  const taskReasonCodesByWordId = {};
  for (const item of taskItems || []) {
    if (!item?.wordId) continue;
    if (item.labels?.length) {
      taskLabelsByWordId[String(item.wordId)] = item.labels;
    }
    if (item.reasonCodes?.length) {
      taskReasonCodesByWordId[String(item.wordId)] = item.reasonCodes;
    }
  }
  return { taskLabelsByWordId, taskReasonCodesByWordId };
}

function buildSelectedQueue(library, selection) {
  const libraryById = new Map(library.map((entry) => [entry.id, entry]));
  const output = [];
  const seen = new Set();

  const normalizedIncludedBookNames = Array.isArray(selection.includedBookNames) ? selection.includedBookNames : [];
  for (const bookName of normalizedIncludedBookNames) {
    for (const entry of library) {
      const entryBookNames = Array.isArray(entry.bookNames) ? entry.bookNames : [];
      const match = entryBookNames.includes(bookName) || entry.bookName === bookName;
      if (!match) continue;
      if (!seen.has(entry.id)) {
        seen.add(entry.id);
        output.push(entry.id);
      }
    }
  }

  const normalizedWordIds = Array.isArray(selection.wordIds) ? selection.wordIds : [];
  for (const id of normalizedWordIds) {
    const wordId = Number(id);
    if (!wordId) continue;
    if (!seen.has(wordId)) {
      seen.add(wordId);
      output.push(wordId);
    }
  }

  const existing = output.filter((id) => libraryById.has(id));
  return existing;
}

async function saveAnswerRecord(
  answerRecordRepository,
  { session, current, userInput, isCorrect, isSkipped, answeredAt, answerDurationMs },
) {
  return answerRecordRepository.createAnswerRecord({
    userId: DEFAULT_USER_ID,
    sessionId: session?.id || "",
    wordId: current?.id,
    bookName: current?.bookName || "",
    expectedAnswer: current?.lemma || "",
    userInput,
    isCorrect,
    isSkipped,
    isTimeout: false,
    answerDurationMs,
    answeredAt,
  });
}

async function updateWrongWordFromAnswer(
  wrongWordRepository,
  { current, userInput, isCorrect, isSkipped, answeredAt, answerRecordId },
) {
  if (isCorrect) {
    await wrongWordRepository.recordCorrectAttempt({
      userId: DEFAULT_USER_ID,
      wordId: current?.id,
      answeredAt,
      answerRecordId,
    });
    return;
  }

  await wrongWordRepository.recordWrongAttempt({
    userId: DEFAULT_USER_ID,
    wordId: current?.id,
    wrongAnswer: userInput,
    answeredAt,
    errorType: getErrorType({ userInput, isSkipped }),
    answerRecordId,
  });
}

async function updateMemoryFromAnswer(wordMemoryRepository, { current, isCorrect, isSkipped, answeredAt }) {
  await wordMemoryRepository.recordPractice({
    userId: DEFAULT_USER_ID,
    wordId: current?.id,
    isCorrect,
    isSkipped,
    answeredAt,
  });
}

async function enrichLibraryWithMemoryState(library, wordMemoryRepository) {
  const memories = await wordMemoryRepository.listMemories({ userId: DEFAULT_USER_ID });
  const memoryByWordId = new Map(memories.map((memory) => [Number(memory.wordId), memory]));
  return (Array.isArray(library) ? library : []).map((entry) => {
    const memory = memoryByWordId.get(Number(entry.id));
    return {
      ...entry,
      memoryState: memory?.state || "unlearned",
      memoryStateText: memory?.stateText || "未学习",
      memoryConsecutiveCorrectCount: Number(memory?.consecutiveCorrectCount || 0),
      memoryConsecutiveWrongCount: Number(memory?.consecutiveWrongCount || 0),
      memoryLastPracticedAt: Number(memory?.lastPracticedAt || 0),
      memoryNextReviewTime: Number(memory?.nextReviewTime || 0),
      memoryReviewIntervalDays: Number(memory?.reviewIntervalDays || 0),
    };
  });
}

function getErrorType({ userInput, isSkipped }) {
  if (isSkipped) return "skipped";
  if (!String(userInput || "").trim()) return "blank";
  return "spelling";
}

async function saveSession(dictationSessionRepository, session) {
  await dictationSessionRepository.setRawSession(JSON.stringify(session));
}

async function readSession(dictationSessionRepository) {
  const raw = await dictationSessionRepository.getRawSession();
  if (!raw) {
    return emptySession();
  }
  try {
    const parsed = JSON.parse(raw);
    const normalized = normalizeSession(parsed);
    if (normalized.id && normalized.id !== parsed.id) {
      await saveSession(dictationSessionRepository, normalized);
    }
    return normalized;
  } catch {
    return emptySession();
  }
}

function emptySession() {
  return {
    id: "",
    queue: [],
    index: 0,
    scope: "all",
    updatedAt: 0,
    taskLabelsByWordId: {},
    taskReasonCodesByWordId: {},
  };
}

function normalizeSession(session) {
  if (!session || !Array.isArray(session.queue) || !session.queue.length) {
    return emptySession();
  }
  const queue = session.queue.map((id) => Number(id)).filter((id) => id > 0);
  if (!queue.length) {
    return emptySession();
  }
  const index = clamp(Number(session.index) || 0, 0, queue.length);
  if (index >= queue.length) {
    return emptySession();
  }
  return {
    id: typeof session.id === "string" && session.id.trim() ? session.id.trim() : createSessionId(),
    queue,
    index,
    scope: normalizeScope(session.scope),
    updatedAt: Number(session.updatedAt) || Date.now(),
    taskLabelsByWordId: normalizeTaskLabelMap(session.taskLabelsByWordId),
    taskReasonCodesByWordId: normalizeReasonCodeMap(session.taskReasonCodesByWordId),
  };
}

function normalizeTaskLabelMap(value) {
  const output = {};
  if (!value || typeof value !== "object") return output;
  Object.entries(value).forEach(([wordId, labels]) => {
    const normalizedWordId = Number(wordId);
    const normalizedLabels = normalizeTaskLabels(labels);
    if (normalizedWordId && normalizedLabels.length) {
      output[String(normalizedWordId)] = normalizedLabels;
    }
  });
  return output;
}

function normalizeReasonCodeMap(value) {
  const output = {};
  if (!value || typeof value !== "object") return output;
  Object.entries(value).forEach(([wordId, reasonCodes]) => {
    const normalizedWordId = Number(wordId);
    const normalizedReasons = normalizeReasonCodes(reasonCodes);
    if (normalizedWordId && normalizedReasons.length) {
      output[String(normalizedWordId)] = normalizedReasons;
    }
  });
  return output;
}

function getCurrentSessionWord(library, session) {
  const normalized = normalizeSession(session);
  if (!normalized.queue.length) {
    return null;
  }
  const id = normalized.queue[normalized.index];
  const entry = library.find((item) => Number(item.id) === Number(id));
  if (!entry) return null;
  const labels = normalizeTaskLabels(normalized.taskLabelsByWordId?.[String(id)] || []);
  const reasonCodes = normalizeReasonCodes(normalized.taskReasonCodesByWordId?.[String(id)] || []);
  return {
    ...entry,
    taskLabels: labels,
    taskLabelTexts: labels.map((label) => TASK_LABEL_TEXT[label]).filter(Boolean),
    taskReasonCodes: reasonCodes,
  };
}

function createSessionId() {
  return `dictation-${randomUUID()}`;
}

function buildStats(library) {
  const now = Date.now();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return {
    totalWords: library.length,
    dueWords: library.filter((entry) => entry.memoryState !== "unlearned" && entry.memoryNextReviewTime <= now).length,
    todayWords: library.filter((entry) => entry.createdAt >= startOfDay.getTime()).length,
  };
}

function buildDiff(answer, target) {
  const normalizedTarget = String(target || "");
  const maxLength = Math.max(answer.length, normalizedTarget.length);
  const chunks = [];
  for (let index = 0; index < maxLength; index += 1) {
    const expected = normalizedTarget[index] || "";
    const actual = answer[index] || "";
    if (expected === actual) {
      chunks.push(expected);
    } else {
      chunks.push(`[${actual || "_"}→${expected || "_"}]`);
    }
  }
  return `${chunks.join("")}，正确答案是 ${normalizedTarget}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

module.exports = {
  createDictationService,
};
