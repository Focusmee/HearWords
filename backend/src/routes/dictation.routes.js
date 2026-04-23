function createDictationRoutes({ dictationController }) {
  return {
    async handle(request, response, url) {
      if (request.method === "POST" && url.pathname === "/api/dictation/start") {
        await dictationController.handleStart(request, response);
        return true;
      }

      if (request.method === "GET" && url.pathname === "/api/dictation/session") {
        await dictationController.handleGetSession(request, response);
        return true;
      }

      if (request.method === "DELETE" && url.pathname === "/api/dictation/session") {
        await dictationController.handleResetSession(request, response);
        return true;
      }

      if (request.method === "POST" && url.pathname === "/api/dictation/check") {
        await dictationController.handleCheck(request, response);
        return true;
      }

      if (request.method === "POST" && url.pathname === "/api/dictation/skip") {
        await dictationController.handleSkip(request, response);
        return true;
      }

      return false;
    },
  };
}

module.exports = {
  createDictationRoutes,
};

