function createImportRoutes({ importController }) {
  return {
    async handle(request, response, url) {
      if (request.method === "POST" && url.pathname === "/api/ocr") {
        await importController.handleOcr(request, response);
        return true;
      }

      if (request.method === "POST" && url.pathname === "/api/extract-document") {
        await importController.handleExtractDocument(request, response);
        return true;
      }

      if (request.method === "POST" && url.pathname === "/api/parse") {
        await importController.handleParse(request, response);
        return true;
      }

      if (request.method === "POST" && url.pathname === "/api/library/import") {
        await importController.handleLibraryImport(request, response);
        return true;
      }

      return false;
    },
  };
}

module.exports = {
  createImportRoutes,
};
