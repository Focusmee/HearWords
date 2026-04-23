function createImportController({ importService, readJsonBody, sendJson }) {
  async function handleJson(request, response, handler) {
    try {
      const body = await readJsonBody(request);
      const payload = await handler(body);
      return sendJson(response, 200, payload);
    } catch (error) {
      return sendJson(response, error.statusCode || 500, { error: error.message || "服务器异常" });
    }
  }

  return {
    async handleOcr(request, response) {
      return handleJson(request, response, (body) => importService.recognizeImage(body));
    },

    async handleExtractDocument(request, response) {
      return handleJson(request, response, (body) => importService.extractDocument(body));
    },

    async handleParse(request, response) {
      return handleJson(request, response, (body) => importService.parseText(body));
    },

    async handleLibraryImport(request, response) {
      return handleJson(request, response, (body) => importService.importEntries(body));
    },
  };
}

module.exports = {
  createImportController,
};
