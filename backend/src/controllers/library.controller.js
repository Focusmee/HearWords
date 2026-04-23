function createLibraryController({ libraryService, readJsonBody, sendJson }) {
  return {
    async handleGetLibrary(request, response) {
      try {
        const payload = await libraryService.getLibrarySnapshot();
        return sendJson(response, 200, payload);
      } catch (error) {
        return sendJson(response, error.statusCode || 500, { error: error.message || "服务器异常" });
      }
    },

    async handleListBooks(request, response) {
      try {
        const payload = await libraryService.listBooks();
        return sendJson(response, 200, payload);
      } catch (error) {
        return sendJson(response, error.statusCode || 500, { error: error.message || "服务器异常" });
      }
    },

    async handleListEntries(request, response, url) {
      try {
        const payload = await libraryService.listEntries({
          page: url.searchParams.get("page"),
          pageSize: url.searchParams.get("pageSize"),
          bookName: url.searchParams.get("bookName"),
          sourceName: url.searchParams.get("sourceName"),
          query: url.searchParams.get("query") || url.searchParams.get("q"),
        });
        return sendJson(response, 200, payload);
      } catch (error) {
        return sendJson(response, error.statusCode || 500, { error: error.message || "服务器异常" });
      }
    },

    async handleUpdateEntry(request, response, id) {
      try {
        const body = await readJsonBody(request);
        const payload = await libraryService.updateEntry({
          id,
          definition: body?.definition,
          exampleSentence: body?.exampleSentence,
        });
        return sendJson(response, 200, payload);
      } catch (error) {
        return sendJson(response, error.statusCode || 500, { error: error.message || "服务器异常" });
      }
    },

    async handleDeleteEntry(request, response, id) {
      try {
        const payload = await libraryService.deleteEntry(id);
        return sendJson(response, 200, payload);
      } catch (error) {
        return sendJson(response, error.statusCode || 500, { error: error.message || "服务器异常" });
      }
    },
  };
}

module.exports = {
  createLibraryController,
};

