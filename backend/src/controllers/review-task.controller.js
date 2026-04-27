function createReviewTaskController({ reviewTaskService, sendJson }) {
  return {
    async handleGetTodayTask(_request, response, url) {
      try {
        const payload = await reviewTaskService.getTodayTask({
          intensity: url?.searchParams?.get("intensity") || "",
          bookName: url?.searchParams?.get("bookName") || "",
        });
        return sendJson(response, 200, payload);
      } catch (error) {
        return sendJson(response, error.statusCode || 500, { error: error.message || "服务异常。" });
      }
    },
  };
}

module.exports = {
  createReviewTaskController,
};
