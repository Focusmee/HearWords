function createLearningReportRoutes({ learningReportController }) {
  return {
    async handle(request, response, url) {
      if (request.method === "GET" && url.pathname === "/api/learning-report") {
        await learningReportController.handleGetReport(request, response);
        return true;
      }

      return false;
    },
  };
}

module.exports = {
  createLearningReportRoutes,
};
