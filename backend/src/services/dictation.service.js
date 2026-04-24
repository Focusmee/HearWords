const REVIEW_STEPS = [
  10 * 60 * 1000,
  60 * 60 * 1000,
  8 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
  3 * 24 * 60 * 60 * 1000,
  7 * 24 * 60 * 60 * 1000,
];

function createDictationService({ dictationSessionRepository, dictationSelectionRepository, wordRepository }) {
  return {
    async startSession({ scope, includedBookNames, bookNames, wordIds } = {}) {
      const normalizedScope = "all";
      const selectionInput = normalizeSelectionInput({ includedBookNames, bookNames, wordIds });
      const hasSelection = selectionInput.includedBookNames.length || selectionInput.wordIds.length;

      if (hasSelection) {
        await dictationSelectionRepository.setSelection(selectionInput);
      }

      const library = await wordRepository.listLibraryEntries();
      const queue = hasSelection
        ? buildSelectedQueue(library, selectionInput)
        : library.map((item) => item.id);

      const session = queue.length
        ? { queue, index: 0, scope: normalizedScope, updatedAt: Date.now() }
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
      const library = await wordRepository.listLibraryEntries();
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

    async checkAnswer({ answer } = {}) {
      const normalizedAnswer = String(answer || "").trim().toLowerCase();
      const session = await readSession(dictationSessionRepository);
      const library = await wordRepository.listLibraryEntries();
      const current = getCurrentSessionWord(library, session);

      if (!current) {
        throw createHttpError(400, "当前没有进行中的听写。");
      }
      if (!normalizedAnswer) {
        throw createHttpError(400, "请输入答案。");
      }

      current.dictationAttempts = Number(current.dictationAttempts || 0) + 1;
      const correct = normalizedAnswer === String(current.lemma || "").toLowerCase();
      if (correct) {
        const nextLevel = Math.min(5, Number(current.masteryLevel || 0) + 1);
        current.masteryLevel = nextLevel;
        current.nextReviewTime = Date.now() + REVIEW_STEPS[Math.max(0, nextLevel - 1)];
        current.updatedAt = Date.now();
        await wordRepository.saveLibraryEntry(current);

        session.index += 1;
        session.updatedAt = Date.now();
        const normalizedSession = normalizeSession(session);
        await saveSession(dictationSessionRepository, normalizedSession);

        const nextLibrary = await wordRepository.listLibraryEntries();
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
      current.nextReviewTime = Date.now() + REVIEW_STEPS[0];
      current.updatedAt = Date.now();
      await wordRepository.saveLibraryEntry(current);

      const nextLibrary = await wordRepository.listLibraryEntries();
      return {
        correct: false,
        expected: current.lemma,
        diff: buildDiff(normalizedAnswer, current.lemma),
        finished: false,
        current,
        session,
        stats: buildStats(nextLibrary),
      };
    },

    async skipCurrent() {
      const session = await readSession(dictationSessionRepository);
      const library = await wordRepository.listLibraryEntries();
      const current = getCurrentSessionWord(library, session);

      if (!current) {
        throw createHttpError(400, "当前没有进行中的听写。");
      }

      current.dictationAttempts = Number(current.dictationAttempts || 0) + 1;
      current.failCount = Number(current.failCount || 0) + 1;
      current.nextReviewTime = Date.now() + REVIEW_STEPS[0];
      current.updatedAt = Date.now();
      await wordRepository.saveLibraryEntry(current);

      session.index += 1;
      session.updatedAt = Date.now();
      const normalizedSession = normalizeSession(session);
      await saveSession(dictationSessionRepository, normalizedSession);
      const nextLibrary = await wordRepository.listLibraryEntries();
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

function normalizeSelectionInput({ includedBookNames, bookNames, wordIds } = {}) {
  return {
    includedBookNames: Array.from(
      new Set(
        (Array.isArray(bookNames) ? bookNames : []).concat(Array.isArray(includedBookNames) ? includedBookNames : [])
          .map((value) => String(value || "").trim())
          .filter(Boolean),
      ),
    ),
    wordIds: Array.from(new Set((Array.isArray(wordIds) ? wordIds : []).map((id) => Number(id)).filter((id) => id > 0))),
  };
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

async function saveSession(dictationSessionRepository, session) {
  await dictationSessionRepository.setRawSession(JSON.stringify(session));
}

async function readSession(dictationSessionRepository) {
  const raw = await dictationSessionRepository.getRawSession();
  if (!raw) {
    return emptySession();
  }
  try {
    return normalizeSession(JSON.parse(raw));
  } catch {
    return emptySession();
  }
}

function emptySession() {
  return {
    queue: [],
    index: 0,
    scope: "all",
    updatedAt: 0,
  };
}

function normalizeSession(session) {
  if (!session || !Array.isArray(session.queue) || !session.queue.length) {
    return emptySession();
  }
  const index = clamp(Number(session.index) || 0, 0, session.queue.length);
  if (index >= session.queue.length) {
    return emptySession();
  }
  return {
    queue: session.queue,
    index,
    scope: "all",
    updatedAt: Number(session.updatedAt) || Date.now(),
  };
}

function getCurrentSessionWord(library, session) {
  const normalized = normalizeSession(session);
  if (!normalized.queue.length) {
    return null;
  }
  const id = normalized.queue[normalized.index];
  return library.find((entry) => entry.id === id) || null;
}

function buildStats(library) {
  const now = Date.now();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return {
    totalWords: library.length,
    dueWords: library.filter((entry) => entry.nextReviewTime <= now).length,
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
