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

