function createLearningReportController({ learningReportService, sendJson }) {
  return {
    async handleGetReport(_request, response) {
      try {
        const payload = await learningReportService.getLearningReport();
        return sendJson(response, 200, payload);
      } catch (error) {
        return sendJson(response, error.statusCode || 500, { error: error.message || "服务异常。" });
      }
    },
  };
}

module.exports = {
  createLearningReportController,
};
