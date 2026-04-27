const {
  STATUS_IMPORTANT_REVIEW,
  STATUS_MASTERED,
  STATUS_TO_CONSOLIDATE,
} = require("../repositories/wrong-word.repository");
const {
  STATE_UNLEARNED,
  STATE_TEXT,
} = require("../repositories/word-memory.repository");

const DEFAULT_USER_ID = "local";

const INTENSITY_CONFIG = {
  light: { targetCount: 15, range: "10-20" },
  standard: { targetCount: 40, range: "30-50" },
  sprint: { targetCount: 80, range: "60-100" },
};

const LABEL_TEXT = {
  new: "新词",
  review: "复习",
  wrong_word: "错词",
  important: "重点",
};

function createReviewTaskService({ wordRepository, wrongWordRepository, wordMemoryRepository }) {
  return {
    async getTodayTask({ intensity, bookName } = {}) {
      const normalizedIntensity = normalizeIntensity(intensity);
      const config = INTENSITY_CONFIG[normalizedIntensity];
      const normalizedBookName = normalizeText(bookName);
      const now = Date.now();
      const library = await wordRepository.listLibraryEntries(
        normalizedBookName ? { bookName: normalizedBookName } : {},
      );
      const wrongWords = await wrongWordRepository.listWrongWords({ userId: DEFAULT_USER_ID });
      const memories = await wordMemoryRepository.listMemories({ userId: DEFAULT_USER_ID });
      const libraryById = new Map(library.map((word) => [Number(word.id), word]));
      const wrongByWordId = new Map(wrongWords.map((item) => [Number(item.wordId), item]));
      const memoryByWordId = new Map(memories.map((item) => [Number(item.wordId), item]));

      const selected = [];
      const selectedById = new Map();

      const addWord = (word, reasonCode) => {
        if (!word?.id) return;
        const wordId = Number(word.id);
        const wrongWord = wrongByWordId.get(wordId);
        const memory = memoryByWordId.get(wordId);
        const labels = buildLabels({ word, wrongWord, memory, now });
        const existing = selectedById.get(wordId);
        if (existing) {
          existing.reasonCodes = Array.from(new Set([...existing.reasonCodes, reasonCode]));
          existing.primaryReason = existing.primaryReason || reasonCode;
          existing.labels = Array.from(new Set([...existing.labels, ...labels]));
          existing.labelTexts = existing.labels.map((label) => LABEL_TEXT[label]).filter(Boolean);
          return;
        }
        if (selected.length >= config.targetCount) return;
        const item = {
          wordId,
          lemma: word.lemma,
          definition: word.definition || "",
          nextReviewTime: Number(word.nextReviewTime) || 0,
          memoryState: memory?.state || STATE_UNLEARNED,
          memoryStateText: memory?.stateText || STATE_TEXT[STATE_UNLEARNED],
          memoryNextReviewTime: Number(memory?.nextReviewTime || 0),
          memoryReviewIntervalDays: Number(memory?.reviewIntervalDays || 0),
          totalWrongCount: Number(wrongWord?.totalWrongCount) || 0,
          status: wrongWord?.status || "",
          isImportant: Boolean(wrongWord?.isImportant),
          labels,
          labelTexts: labels.map((label) => LABEL_TEXT[label]).filter(Boolean),
          primaryReason: reasonCode,
          reasonCodes: [reasonCode],
        };
        selectedById.set(wordId, item);
        selected.push(item);
      };

      const dueReviewWords = library
        .filter((word) => isDueReviewWord(word, memoryByWordId, now))
        .sort((a, b) => {
          const dueDiff =
            (Number(memoryByWordId.get(Number(a.id))?.nextReviewTime) || 0) -
            (Number(memoryByWordId.get(Number(b.id))?.nextReviewTime) || 0);
          if (dueDiff !== 0) return dueDiff;
          return getWrongCount(wrongByWordId, b.id) - getWrongCount(wrongByWordId, a.id);
        });

      const frequentWrongWords = wrongWords
        .filter((item) => isFrequentWrongCandidate(item))
        .map((item) => libraryById.get(Number(item.wordId)))
        .filter(Boolean)
        .sort((a, b) => {
          const wrongA = wrongByWordId.get(Number(a.id));
          const wrongB = wrongByWordId.get(Number(b.id));
          const countDiff = Number(wrongB?.totalWrongCount || 0) - Number(wrongA?.totalWrongCount || 0);
          if (countDiff !== 0) return countDiff;
          const streakDiff = Number(wrongB?.consecutiveWrongCount || 0) - Number(wrongA?.consecutiveWrongCount || 0);
          if (streakDiff !== 0) return streakDiff;
          return Number(wrongB?.latestWrongAt || 0) - Number(wrongA?.latestWrongAt || 0);
        });

      const importantWords = wrongWords
        .filter((item) => item.isImportant && item.status !== STATUS_MASTERED)
        .map((item) => libraryById.get(Number(item.wordId)))
        .filter(Boolean)
        .sort((a, b) => {
          const wrongA = wrongByWordId.get(Number(a.id));
          const wrongB = wrongByWordId.get(Number(b.id));
          return Number(wrongB?.latestWrongAt || 0) - Number(wrongA?.latestWrongAt || 0);
        });

      const newWords = library
        .filter((word) => isNewWord(word, memoryByWordId))
        .sort((a, b) => (Number(a.createdAt) || 0) - (Number(b.createdAt) || 0));

      for (const word of dueReviewWords) addWord(word, "due_review");
      for (const word of frequentWrongWords) addWord(word, "frequent_wrong");
      for (const word of importantWords) addWord(word, "marked_important");
      for (const word of newWords) addWord(word, "new_word");

      return {
        id: buildTaskId({ intensity: normalizedIntensity, bookName: normalizedBookName }),
        type: "today_task",
        generatedAt: now,
        intensity: normalizedIntensity,
        targetCount: config.targetCount,
        targetRange: config.range,
        bookName: normalizedBookName,
        explanation: "优先安排已到复习时间的单词、最近常错的单词和你标记的重点错词；数量不足时补充新词。",
        counts: buildSelectedCounts(selected),
        availableCounts: {
          dueReviewWords: dueReviewWords.length,
          frequentWrongWords: frequentWrongWords.length,
          importantWrongWords: importantWords.length,
          newWords: newWords.length,
        },
        wordIds: selected.map((item) => item.wordId),
        items: selected,
      };
    },
  };
}

function buildTaskId({ intensity, bookName }) {
  const date = formatLocalDate(new Date());
  const suffix = bookName ? `-${bookName}` : "";
  return `today-${date}-${intensity}${suffix}`;
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeIntensity(value) {
  const text = normalizeText(value);
  return Object.prototype.hasOwnProperty.call(INTENSITY_CONFIG, text) ? text : "standard";
}

function normalizeText(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

function isNewWord(word, memoryByWordId) {
  const memory = memoryByWordId?.get?.(Number(word?.id));
  return !memory || memory.state === STATE_UNLEARNED;
}

function isDueReviewWord(word, memoryByWordId, now) {
  const memory = memoryByWordId?.get?.(Number(word?.id));
  if (!memory || memory.state === STATE_UNLEARNED) return false;
  return Number(memory.nextReviewTime || 0) <= now;
}

function isFrequentWrongCandidate(item) {
  if (!item || item.status === STATUS_MASTERED) return false;
  return item.status === STATUS_IMPORTANT_REVIEW || item.status === STATUS_TO_CONSOLIDATE;
}

function getWrongCount(wrongByWordId, wordId) {
  return Number(wrongByWordId.get(Number(wordId))?.totalWrongCount || 0);
}

function buildLabels({ word, wrongWord, memory, now }) {
  const labels = [];
  if (!memory || memory.state === STATE_UNLEARNED) labels.push("new");
  if (memory && memory.state !== STATE_UNLEARNED && Number(memory.nextReviewTime || 0) <= now) labels.push("review");
  if (wrongWord && wrongWord.status !== STATUS_MASTERED) labels.push("wrong_word");
  if (wrongWord?.isImportant || wrongWord?.status === STATUS_IMPORTANT_REVIEW) labels.push("important");
  return labels;
}

function buildSelectedCounts(items) {
  const hasLabel = (item, label) => Array.isArray(item.labels) && item.labels.includes(label);
  return {
    totalWords: items.length,
    newWords: items.filter((item) => hasLabel(item, "new")).length,
    reviewWords: items.filter((item) => hasLabel(item, "review")).length,
    wrongWords: items.filter((item) => hasLabel(item, "wrong_word")).length,
    importantWrongWords: items.filter((item) => hasLabel(item, "important") && hasLabel(item, "wrong_word")).length,
  };
}

module.exports = {
  createReviewTaskService,
};
