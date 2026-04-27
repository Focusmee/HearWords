const {
  STATUS_IMPORTANT_REVIEW,
  STATUS_MASTERED,
  STATUS_RECOVERING,
  STATUS_TO_CONSOLIDATE,
} = require("../repositories/wrong-word.repository");
const { STATE_MASTERED } = require("../repositories/word-memory.repository");

const DEFAULT_USER_ID = "local";

const WRONG_STATUS_TEXT = {
  [STATUS_TO_CONSOLIDATE]: "待巩固",
  [STATUS_IMPORTANT_REVIEW]: "重点复习",
  [STATUS_RECOVERING]: "恢复中",
  [STATUS_MASTERED]: "已掌握",
};

function createLearningReportService({
  answerRecordRepository,
  wrongWordRepository,
  wordMemoryRepository,
  reviewTaskService,
}) {
  return {
    async getLearningReport() {
      const now = Date.now();
      const todayStart = getStartOfLocalDay(now);
      const tomorrowStart = todayStart + 24 * 60 * 60 * 1000;
      const sevenDayStart = todayStart - 6 * 24 * 60 * 60 * 1000;

      const [recentRecords, todayRecords, wrongWords, memories, todayTask] = await Promise.all([
        answerRecordRepository.listAnswerRecords({ userId: DEFAULT_USER_ID, since: sevenDayStart, until: tomorrowStart, limit: 5000 }),
        answerRecordRepository.listAnswerRecords({ userId: DEFAULT_USER_ID, since: todayStart, until: tomorrowStart, limit: 2000 }),
        wrongWordRepository.listWrongWords({ userId: DEFAULT_USER_ID }),
        wordMemoryRepository.listMemories({ userId: DEFAULT_USER_ID }),
        reviewTaskService.getTodayTask({ intensity: "standard" }),
      ]);

      const topWrongWords = wrongWords
        .slice()
        .sort((a, b) => {
          const countDiff = Number(b.totalWrongCount || 0) - Number(a.totalWrongCount || 0);
          if (countDiff !== 0) return countDiff;
          return Number(b.latestWrongAt || 0) - Number(a.latestWrongAt || 0);
        })
        .slice(0, 5)
        .map((item) => ({
          wordId: Number(item.wordId),
          lemma: item.lemma,
          totalWrongCount: Number(item.totalWrongCount || 0),
          latestWrongAt: Number(item.latestWrongAt || 0),
          status: item.status,
          statusText: WRONG_STATUS_TEXT[item.status] || "待巩固",
        }));

      const todayOverview = buildOverview({
        records: todayRecords,
        wrongWords,
        memories,
        start: todayStart,
        end: tomorrowStart,
      });
      const trend = buildSevenDayTrend({ records: recentRecords, wrongWords, start: sevenDayStart });
      const errorTypeDistribution = buildErrorTypeDistribution(recentRecords);
      const suggestion = buildSuggestion({
        todayOverview,
        errorTypeDistribution,
        todayTask,
        topWrongWords,
      });

      return {
        generatedAt: now,
        todayOverview,
        trend,
        topWrongWords,
        errorTypeDistribution,
        suggestion,
        todayTask: {
          wordIds: todayTask.wordIds,
          items: todayTask.items,
          counts: todayTask.counts,
        },
        actionWordIds: {
          frequentWrongWords: topWrongWords.map((item) => item.wordId),
          todayTask: todayTask.wordIds,
        },
      };
    },
  };
}

function buildOverview({ records, wrongWords, memories, start, end }) {
  const total = records.length;
  const correct = records.filter((item) => item.isCorrect).length;
  const learningDurationMs = records.reduce((sum, item) => sum + Number(item.answerDurationMs || 0), 0);
  return {
    dictationCount: total,
    correctCount: correct,
    accuracy: total ? Math.round((correct / total) * 1000) / 10 : 0,
    newWrongWords: wrongWords.filter((item) => Number(item.createdAt || 0) >= start && Number(item.createdAt || 0) < end).length,
    masteredWords: memories.filter(
      (item) => item.state === STATE_MASTERED && Number(item.updatedAt || 0) >= start && Number(item.updatedAt || 0) < end,
    ).length,
    learningDurationMs,
  };
}

function buildSevenDayTrend({ records, wrongWords, start }) {
  const days = [];
  for (let index = 0; index < 7; index += 1) {
    const dayStart = start + index * 24 * 60 * 60 * 1000;
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const dayRecords = records.filter((item) => Number(item.answeredAt || 0) >= dayStart && Number(item.answeredAt || 0) < dayEnd);
    const correct = dayRecords.filter((item) => item.isCorrect).length;
    const count = dayRecords.length;
    days.push({
      date: formatLocalDate(new Date(dayStart)),
      dictationCount: count,
      correctCount: correct,
      accuracy: count ? Math.round((correct / count) * 1000) / 10 : 0,
      newWrongWords: wrongWords.filter((item) => Number(item.createdAt || 0) >= dayStart && Number(item.createdAt || 0) < dayEnd).length,
    });
  }
  return days;
}

function buildErrorTypeDistribution(records) {
  const wrongRecords = records.filter((item) => !item.isCorrect);
  const spelling = wrongRecords.filter((item) => !item.isSkipped && String(item.userInput || "").trim()).length;
  const blankOrSkipped = wrongRecords.filter((item) => item.isSkipped || !String(item.userInput || "").trim()).length;
  const other = Math.max(0, wrongRecords.length - spelling - blankOrSkipped);
  return [
    { type: "spelling", label: "拼写错误", count: spelling },
    { type: "blank_or_skipped", label: "空白 / 跳过", count: blankOrSkipped },
    { type: "other", label: "其他错误", count: other },
  ];
}

function buildSuggestion({ todayOverview, errorTypeDistribution, todayTask, topWrongWords }) {
  const spelling = errorTypeDistribution.find((item) => item.type === "spelling")?.count || 0;
  const blankOrSkipped = errorTypeDistribution.find((item) => item.type === "blank_or_skipped")?.count || 0;
  if (!todayOverview.dictationCount) {
    return {
      title: "先完成今日任务",
      text: "今天还没有听写记录。先从今日任务开始，系统会自动安排新词、复习词和错词。",
      action: "today_task",
      wordIds: todayTask.wordIds,
    };
  }
  if (spelling >= blankOrSkipped && spelling > 0 && topWrongWords.length) {
    return {
      title: "优先练高频错词",
      text: "最近拼写错误较多。建议先练习高频错词，再回到今日任务。",
      action: "frequent_wrong_words",
      wordIds: topWrongWords.map((item) => item.wordId),
    };
  }
  if (Number(todayTask?.counts?.reviewWords || 0) > 0) {
    return {
      title: "完成到期复习",
      text: "今天还有到期复习词。先完成复习词，可以让记忆间隔继续拉长。",
      action: "today_task",
      wordIds: todayTask.wordIds,
    };
  }
  if (todayOverview.masteredWords > 0 && todayOverview.accuracy >= 80) {
    return {
      title: "可以增加少量新词",
      text: "今天已经有单词进入掌握状态，且正确率不错。可以用标准强度继续加入新词。",
      action: "today_task",
      wordIds: todayTask.wordIds,
    };
  }
  return {
    title: "保持标准节奏",
    text: "继续按今日任务推进即可。错词会自动进入错词本，后续复习会优先安排。",
    action: "today_task",
    wordIds: todayTask.wordIds,
  };
}

function getStartOfLocalDay(timestamp) {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

module.exports = {
  createLearningReportService,
};
