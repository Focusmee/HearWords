const DEFAULT_USER_ID = "local";

function createWrongWordsService({ wrongWordRepository }) {
  return {
    async listWrongWords({ status } = {}) {
      const [items, stats] = await Promise.all([
        wrongWordRepository.listWrongWords({ userId: DEFAULT_USER_ID, status }),
        wrongWordRepository.getWrongWordStats({ userId: DEFAULT_USER_ID }),
      ]);

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const todayStart = startOfDay.getTime();

      return {
        items: items.map((item) => ({
          ...item,
          isNewToday: Number(item.createdAt || 0) >= todayStart,
        })),
        stats,
      };
    },

    async setImportant({ wordId, important }) {
      const item = await wrongWordRepository.setImportant({
        userId: DEFAULT_USER_ID,
        wordId,
        important,
      });
      if (!item) {
        throw createHttpError(404, "错词不存在。");
      }
      return {
        item,
        stats: await wrongWordRepository.getWrongWordStats({ userId: DEFAULT_USER_ID }),
      };
    },

    async markMastered({ wordId }) {
      const item = await wrongWordRepository.markMastered({
        userId: DEFAULT_USER_ID,
        wordId,
      });
      if (!item) {
        throw createHttpError(404, "错词不存在。");
      }
      return {
        item,
        stats: await wrongWordRepository.getWrongWordStats({ userId: DEFAULT_USER_ID }),
      };
    },
  };
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

module.exports = {
  createWrongWordsService,
};
