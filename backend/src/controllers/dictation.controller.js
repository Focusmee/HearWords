function createDictationController({ dictationService, readJsonBody, sendJson }) {
  return {
    async handleStart(request, response) {
      try {
        const body = await readJsonBody(request);
        const payload = await dictationService.startSession(body);
        return sendJson(response, 200, payload);
      } catch (error) {
        return sendJson(response, error.statusCode || 500, { error: error.message || "服务器异常" });
      }
    },

    async handleGetSession(_request, response) {
      try {
        const payload = await dictationService.getSession();
        return sendJson(response, 200, payload);
      } catch (error) {
        return sendJson(response, error.statusCode || 500, { error: error.message || "服务器异常" });
      }
    },

    async handleResetSession(_request, response) {
      try {
        const payload = await dictationService.resetSession();
        return sendJson(response, 200, payload);
      } catch (error) {
        return sendJson(response, error.statusCode || 500, { error: error.message || "服务器异常" });
      }
    },

    async handleCheck(request, response) {
      try {
        const body = await readJsonBody(request);
        const payload = await dictationService.checkAnswer(body);
        return sendJson(response, 200, payload);
      } catch (error) {
        return sendJson(response, error.statusCode || 500, { error: error.message || "服务器异常" });
      }
    },

    async handleSkip(request, response) {
      try {
        const body = await readJsonBody(request);
        const payload = await dictationService.skipCurrent(body);
        return sendJson(response, 200, payload);
      } catch (error) {
        return sendJson(response, error.statusCode || 500, { error: error.message || "服务器异常" });
      }
    },
  };
}

module.exports = {
  createDictationController,
};
