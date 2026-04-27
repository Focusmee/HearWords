function createWrongWordsController({ wrongWordsService, readJsonBody, sendJson }) {
  return {
    async handleList(request, response, url) {
      try {
        const payload = await wrongWordsService.listWrongWords({
          status: url?.searchParams?.get("status") || "",
        });
        return sendJson(response, 200, payload);
      } catch (error) {
        return sendJson(response, error.statusCode || 500, { error: error.message || "服务异常。" });
      }
    },

    async handleSetImportant(request, response, wordId) {
      try {
        const body = await readJsonBody(request);
        const payload = await wrongWordsService.setImportant({
          wordId,
          important: body?.important !== false,
        });
        return sendJson(response, 200, payload);
      } catch (error) {
        return sendJson(response, error.statusCode || 500, { error: error.message || "服务异常。" });
      }
    },

    async handleMarkMastered(_request, response, wordId) {
      try {
        const payload = await wrongWordsService.markMastered({ wordId });
        return sendJson(response, 200, payload);
      } catch (error) {
        return sendJson(response, error.statusCode || 500, { error: error.message || "服务异常。" });
      }
    },
  };
}

module.exports = {
  createWrongWordsController,
};
