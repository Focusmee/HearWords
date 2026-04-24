function createBooksService({ bookRepository }) {
  return {
    async listBooks() {
      return {
        items: await bookRepository.listBooks(),
      };
    },
    
    async createBook({ name }) {
      const normalizedName = typeof name === "string" ? name.trim() : "";
      if (!normalizedName) {
        const error = new Error("缺少词书名称");
        error.statusCode = 400;
        throw error;
      }

      const item = await bookRepository.ensureBook({ name: normalizedName });
      return {
        item,
      };
    },

    async deleteBook({ bookId }) {
      const normalizedBookId = Number(bookId);
      if (!normalizedBookId) {
        const error = new Error("缺少 bookId");
        error.statusCode = 400;
        throw error;
      }

      const result = await bookRepository.deleteBook(normalizedBookId);
      if (!result?.removedBook) {
        const error = new Error("词书不存在");
        error.statusCode = 404;
        throw error;
      }

      return {
        message: "词书已删除",
        bookId: normalizedBookId,
        removedLinks: Number(result?.removedLinks) || 0,
      };
    },

    async addWords({ bookId, wordIds, sourceName }) {
      const normalizedBookId = Number(bookId);
      if (!normalizedBookId) {
        const error = new Error("缺少 bookId");
        error.statusCode = 400;
        throw error;
      }

      const result = await bookRepository.addWordsToBook({
        bookId: normalizedBookId,
        wordIds,
        sourceName,
      });

      return {
        bookId: normalizedBookId,
        ...result,
      };
    },

    async addWordsToBooks({ bookIds, wordIds, sourceName }) {
      const normalizedBookIds = Array.from(
        new Set((Array.isArray(bookIds) ? bookIds : []).map((id) => Number(id)).filter((id) => id > 0)),
      );
      const normalizedWordIds = Array.from(
        new Set((Array.isArray(wordIds) ? wordIds : []).map((id) => Number(id)).filter((id) => id > 0)),
      );
      const src = typeof sourceName === "string" ? sourceName.trim() : "";

      if (!normalizedBookIds.length) {
        const error = new Error("缺少 bookIds");
        error.statusCode = 400;
        throw error;
      }
      if (!normalizedWordIds.length) {
        const error = new Error("缺少 wordIds");
        error.statusCode = 400;
        throw error;
      }

      const results = [];
      let totalAddedLinks = 0;
      let totalSkippedLinks = 0;

      for (const bookId of normalizedBookIds) {
        const result = await bookRepository.addWordsToBook({
          bookId,
          wordIds: normalizedWordIds,
          sourceName: src,
        });
        totalAddedLinks += Number(result.addedLinks) || 0;
        totalSkippedLinks += Number(result.skippedLinks) || 0;
        results.push({
          bookId,
          ...result,
        });
      }

      return {
        items: results,
        totals: {
          books: normalizedBookIds.length,
          words: normalizedWordIds.length,
          addedLinks: totalAddedLinks,
          skippedLinks: totalSkippedLinks,
        },
      };
    },

    async removeWords({ bookId, wordIds }) {
      const normalizedBookId = Number(bookId);
      if (!normalizedBookId) {
        const error = new Error("缺少 bookId");
        error.statusCode = 400;
        throw error;
      }

      const result = await bookRepository.removeWordsFromBook({
        bookId: normalizedBookId,
        wordIds,
      });

      return {
        bookId: normalizedBookId,
        ...result,
      };
    },
  };
}

module.exports = {
  createBooksService,
};
