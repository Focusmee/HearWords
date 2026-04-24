function createBooksRoutes({ booksController }) {
  return {
    async handle(request, response, url) {
      if (request.method === "GET" && url.pathname === "/api/books") {
        await booksController.handleListBooks(request, response);
        return true;
      }

      if (request.method === "POST" && url.pathname === "/api/books") {
        await booksController.handleCreateBook(request, response);
        return true;
      }

      if (request.method === "POST" && url.pathname === "/api/books/batch/words") {
        await booksController.handleBatchAddWords(request, response);
        return true;
      }

      if (request.method === "DELETE" && url.pathname.startsWith("/api/books/") && !url.pathname.endsWith("/words")) {
        const prefix = "/api/books/";
        const raw = url.pathname.slice(prefix.length);
        const bookId = decodeURIComponent(raw).replaceAll("/", "");
        if (!bookId) {
          return false;
        }
        await booksController.handleDeleteBook(request, response, bookId);
        return true;
      }

      if (url.pathname.startsWith("/api/books/") && url.pathname.endsWith("/words")) {
        const prefix = "/api/books/";
        const raw = url.pathname.slice(prefix.length, url.pathname.length - "/words".length);
        const bookId = decodeURIComponent(raw).replaceAll("/", "");
        if (!bookId) {
          return false;
        }

        if (request.method === "POST") {
          await booksController.handleAddWords(request, response, bookId);
          return true;
        }

        if (request.method === "DELETE") {
          await booksController.handleRemoveWords(request, response, bookId);
          return true;
        }
      }

      return false;
    },
  };
}

module.exports = {
  createBooksRoutes,
};
