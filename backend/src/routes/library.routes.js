function createLibraryRoutes({ libraryController }) {
  return {
    async handle(request, response, url) {
      if (request.method === "GET" && url.pathname === "/api/library") {
        await libraryController.handleGetLibrary(request, response);
        return true;
      }

      if (request.method === "GET" && url.pathname === "/api/library/books") {
        await libraryController.handleListBooks(request, response);
        return true;
      }

      if (request.method === "GET" && url.pathname === "/api/library/entries") {
        await libraryController.handleListEntries(request, response, url);
        return true;
      }

      if (request.method === "PATCH" && url.pathname.startsWith("/api/library/")) {
        const id = decodeURIComponent(url.pathname.replace("/api/library/", ""));
        if (!id || id === "books" || id === "entries") {
          return false;
        }
        await libraryController.handleUpdateEntry(request, response, id);
        return true;
      }

      if (request.method === "DELETE" && url.pathname.startsWith("/api/library/")) {
        const id = decodeURIComponent(url.pathname.replace("/api/library/", ""));
        if (!id || id === "books" || id === "entries") {
          return false;
        }
        await libraryController.handleDeleteEntry(request, response, id);
        return true;
      }

      return false;
    },
  };
}

module.exports = {
  createLibraryRoutes,
};

