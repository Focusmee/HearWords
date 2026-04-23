function createPaddleOcrService({ getSettings }) {
  return {
    async layoutParseToMarkdown({ filename, fileBase64, fileType }) {
      const settings = getSettings?.() || {};
      const paddle = settings.paddleOcr || {};

      if (!paddle.enabled) {
        throw new Error("PaddleOCR 未启用。");
      }

      const apiUrl = String(paddle.apiUrl || process.env.PADDLE_OCR_API_URL || "").trim();
      const token = String(paddle.token || process.env.PADDLE_OCR_TOKEN || "").trim();
      const timeoutMs = clamp(Number(paddle.timeoutMs) || Number(process.env.PADDLE_OCR_TIMEOUT_MS) || 30000, 2000, 120000);

      if (!apiUrl) {
        throw new Error("PaddleOCR apiUrl 未配置。");
      }
      if (!token) {
        throw new Error("PaddleOCR token 未配置。");
      }

      const normalizedFilename = String(filename || "").trim() || "document";
      const normalizedFileBase64 = String(fileBase64 || "");
      if (!normalizedFileBase64) {
        throw new Error("缺少文件内容。");
      }

      const normalizedFileType = Number(fileType);
      if (normalizedFileType !== 0 && normalizedFileType !== 1) {
        throw new Error("fileType 必须为 0(PDF) 或 1(图片)。");
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {
            Authorization: `token ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            file: normalizedFileBase64,
            fileType: normalizedFileType,
            useDocOrientationClassify: false,
            useDocUnwarping: false,
            useChartRecognition: false,
            filename: normalizedFilename,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const text = await safeReadText(response);
          throw new Error(`PaddleOCR 请求失败：HTTP ${response.status} ${text || ""}`.trim());
        }

        const payload = await response.json();
        const result = payload?.result;
        const layoutResults = result?.layoutParsingResults;
        if (!Array.isArray(layoutResults)) {
          throw new Error("PaddleOCR 返回格式异常：缺少 layoutParsingResults。");
        }

        const markdownChunks = layoutResults
          .map((item) => item?.markdown?.text)
          .filter((text) => typeof text === "string" && text.trim());

        return {
          markdown: markdownChunks.join("\n\n"),
          raw: payload,
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

async function safeReadText(response) {
  try {
    return String(await response.text()).slice(0, 5000);
  } catch {
    return "";
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

module.exports = {
  createPaddleOcrService,
};

