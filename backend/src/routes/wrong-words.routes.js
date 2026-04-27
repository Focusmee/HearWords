function createWrongWordsRoutes({ wrongWordsController }) {
  return {
    async handle(request, response, url) {
      if (request.method === "GET" && url.pathname === "/api/wrong-words") {
        await wrongWordsController.handleList(request, response, url);
        return true;
      }

      if (request.method === "PATCH" && url.pathname.startsWith("/api/wrong-words/")) {
        const importantSuffix = "/important";
        const masteredSuffix = "/mastered";

        if (url.pathname.endsWith(importantSuffix)) {
          const raw = url.pathname.slice("/api/wrong-words/".length, -importantSuffix.length);
          const wordId = decodeURIComponent(raw).replaceAll("/", "");
          if (!wordId) return false;
          await wrongWordsController.handleSetImportant(request, response, wordId);
          return true;
        }

        if (url.pathname.endsWith(masteredSuffix)) {
          const raw = url.pathname.slice("/api/wrong-words/".length, -masteredSuffix.length);
          const wordId = decodeURIComponent(raw).replaceAll("/", "");
          if (!wordId) return false;
          await wrongWordsController.handleMarkMastered(request, response, wordId);
          return true;
        }
      }

      return false;
    },
  };
}

module.exports = {
  createWrongWordsRoutes,
};
