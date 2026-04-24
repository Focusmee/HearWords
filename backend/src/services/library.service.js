const DEFAULT_BOOK_NAME = "未命名词书";
const DEFAULT_SOURCE_NAME = "manual-input";

function createLibraryService({ wordRepository, bookRepository }) {
  return {
    async getOptions() {
      return {
        sources: await bookRepository.listLibraryBooks(),
        books: await bookRepository.listBooks(),
      };
    },

    async getLibrarySnapshot(params = {}) {
      const bookName = typeof params.bookName === "string" ? params.bookName.trim() : "";
      const items = await wordRepository.listLibraryEntries({ bookName });
      return {
        items,
        stats: buildStats(items),
        sources: await bookRepository.listLibraryBooks(),
      };
    },

    async listBooks() {
      return {
        items: await bookRepository.listLibraryBooks(),
      };
    },

    async listEntries(params = {}) {
      const page = clampInteger(params.page, 1, 999999, 1);
      const pageSize = clampInteger(params.pageSize, 1, 200, 50);
      const bookName = typeof params.bookName === "string" ? params.bookName.trim() : "";
      const sourceName = typeof params.sourceName === "string" ? params.sourceName.trim() : "";
      const query = typeof params.query === "string" ? params.query.trim() : "";

      const library = await wordRepository.listLibraryEntries({ bookName });
      const filtered = library.filter((entry) => {
        if (sourceName && String(entry.sourceName || "").trim() !== sourceName) {
          return false;
        }
        if (query) {
          const haystack = `${entry.lemma || ""} ${entry.rawWord || ""} ${entry.definition || ""}`.toLowerCase();
          if (!haystack.includes(query.toLowerCase())) {
            return false;
          }
        }
        return true;
      });

      const total = filtered.length;
      const start = (page - 1) * pageSize;
      const items = filtered.slice(start, start + pageSize);

      return {
        items,
        pagination: {
          page,
          pageSize,
          total,
        },
      };
    },

    async updateEntry({ id, definition, exampleSentence }) {
      if (!id) {
        const error = new Error("缺少 id");
        error.statusCode = 400;
        throw error;
      }

      const target = await wordRepository.findLibraryEntryById(id);
      if (!target) {
        const error = new Error("单词不存在");
        error.statusCode = 404;
        throw error;
      }

      const nextDefinition = typeof definition === "string" ? definition.trim() : target.definition;
      const nextExampleSentence = typeof exampleSentence === "string" ? exampleSentence.trim() : target.exampleSentence;
      const updatedAt = Date.now();

      if (!hasChinese(nextDefinition)) {
        const error = new Error("释义必须包含中文说明（可在中文语境下理解该词的意思）。");
        error.statusCode = 400;
        throw error;
      }

      await wordRepository.updateLibraryEntryTextFields({
        id,
        definition: nextDefinition,
        exampleSentence: nextExampleSentence,
        updatedAt,
      });

      const nextLibrary = await wordRepository.listLibraryEntries();
      const item = nextLibrary.find((entry) => entry.id === id) || null;
      return {
        message: "单词已更新",
        item,
        items: nextLibrary,
        stats: buildStats(nextLibrary),
        sources: await bookRepository.listLibraryBooks(),
      };
    },

    async deleteEntry(id) {
      if (!id) {
        const error = new Error("缺少 id");
        error.statusCode = 400;
        throw error;
      }

      await wordRepository.deleteLibraryEntry(id);
      const library = await wordRepository.listLibraryEntries();
      return {
        message: "单词已删除",
        items: library,
        stats: buildStats(library),
        sources: await bookRepository.listLibraryBooks(),
      };
    },

    async deleteEntriesBatch({ ids }) {
      const normalized = Array.isArray(ids) ? ids : [];
      if (!normalized.length) {
        const error = new Error("缺少 ids");
        error.statusCode = 400;
        throw error;
      }

      const result = await wordRepository.deleteLibraryEntries(normalized);
      const library = await wordRepository.listLibraryEntries();
      return {
        message: `已批量删除：${Number(result?.removed) || 0} 个单词`,
        removed: Number(result?.removed) || 0,
        removedLinks: Number(result?.removedLinks) || 0,
        items: library,
        stats: buildStats(library),
        sources: await bookRepository.listLibraryBooks(),
      };
    },
  };
}

function hasChinese(text) {
  return /[\u4E00-\u9FFF]/.test(String(text || ""));
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

function buildSourceOptions(library) {
  const map = new Map();
  library.forEach((item) => {
    const bookName = item.bookName || DEFAULT_BOOK_NAME;
    const sourceName = item.sourceName || DEFAULT_SOURCE_NAME;
    const key = `${bookName}|${sourceName}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        bookName,
        sourceName,
      });
    }
  });

  return [...map.values()];
}

function clampInteger(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const int = Math.trunc(n);
  if (int < min) return min;
  if (int > max) return max;
  return int;
}

module.exports = {
  createLibraryService,
};
