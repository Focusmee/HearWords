function createReviewTaskRoutes({ reviewTaskController }) {
  return {
    async handle(request, response, url) {
      if (request.method === "GET" && url.pathname === "/api/review/today-task") {
        await reviewTaskController.handleGetTodayTask(request, response, url);
        return true;
      }

      return false;
    },
  };
}

module.exports = {
  createReviewTaskRoutes,
};
