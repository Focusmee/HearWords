function createBooksController({ booksService, readJsonBody, sendJson }) {
  return {
    async handleListBooks(request, response) {
      try {
        const payload = await booksService.listBooks();
        return sendJson(response, 200, payload);
      } catch (error) {
        return sendJson(response, error.statusCode || 500, { error: error.message || "服务器异常" });
      }
    },

    async handleCreateBook(request, response) {
      try {
        const body = await readJsonBody(request);
        const payload = await booksService.createBook({ name: body?.name });
        return sendJson(response, 200, payload);
      } catch (error) {
        return sendJson(response, error.statusCode || 500, { error: error.message || "服务器异常" });
      }
    },

    async handleDeleteBook(request, response, bookId) {
      try {
        const payload = await booksService.deleteBook({ bookId });
        return sendJson(response, 200, payload);
      } catch (error) {
        return sendJson(response, error.statusCode || 500, { error: error.message || "服务器异常" });
      }
    },

    async handleAddWords(request, response, bookId) {
      try {
        const body = await readJsonBody(request);
        const payload = await booksService.addWords({
          bookId,
          wordIds: body?.wordIds,
          sourceName: body?.sourceName,
        });
        return sendJson(response, 200, payload);
      } catch (error) {
        return sendJson(response, error.statusCode || 500, { error: error.message || "服务器异常" });
      }
    },

    async handleBatchAddWords(request, response) {
      try {
        const body = await readJsonBody(request);
        const payload = await booksService.addWordsToBooks({
          bookIds: body?.bookIds,
          wordIds: body?.wordIds,
          sourceName: body?.sourceName,
        });
        return sendJson(response, 200, payload);
      } catch (error) {
        return sendJson(response, error.statusCode || 500, { error: error.message || "服务器异常" });
      }
    },

    async handleRemoveWords(request, response, bookId) {
      try {
        const body = await readJsonBody(request);
        const payload = await booksService.removeWords({
          bookId,
          wordIds: body?.wordIds,
        });
        return sendJson(response, 200, payload);
      } catch (error) {
        return sendJson(response, error.statusCode || 500, { error: error.message || "服务器异常" });
      }
    },
  };
}

module.exports = {
  createBooksController,
};
