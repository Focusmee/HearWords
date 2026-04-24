const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const {
  initializeDatabase,
  getLibrary,
  getDictionaryCount,
  getParseHistory,
} = require("./db");

const { createImportRoutes } = require("./src/routes/import.routes");
const { createDictationRoutes } = require("./src/routes/dictation.routes");
const { createLibraryRoutes } = require("./src/routes/library.routes");
const { createImportController } = require("./src/controllers/import.controller");
const { createDictationController } = require("./src/controllers/dictation.controller");
const { createLibraryController } = require("./src/controllers/library.controller");
const { createImportService } = require("./src/services/import.service");
const { createParserService } = require("./src/services/parser.service");
const { createPaddleOcrService } = require("./src/services/paddle-ocr.service");
const { createDictationService } = require("./src/services/dictation.service");
const { createLibraryService } = require("./src/services/library.service");
const { createBooksService } = require("./src/services/books.service");
const textProcessingService = require("./src/services/text-processing.service");
const wordRepository = require("./src/repositories/word.repository");
const bookRepository = require("./src/repositories/book.repository");
const dictationSessionRepository = require("./src/repositories/dictation-session.repository");
const dictationSelectionRepository = require("./src/repositories/dictation-selection.repository");
const { createBooksController } = require("./src/controllers/books.controller");
const { createBooksRoutes } = require("./src/routes/books.routes");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 3000);
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, "data");
const SETTINGS_PATH = path.join(DATA_DIR, "settings.json");

const STATIC_FILES = {
  "/": "index.html",
  "/index.html": "index.html",
  "/app.js": "app.js",
  "/styles.css": "styles.css",
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

fs.mkdirSync(DATA_DIR, { recursive: true });
ensureSettingsFile();

bootstrap().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function bootstrap() {
  await initializeDatabase();

  const parserService = createParserService({ textProcessingService });
  const paddleOcrService = createPaddleOcrService({ getSettings: readSettings });
  const importService = createImportService({
    parserService,
    paddleOcrService,
    textProcessingService,
    wordRepository,
    getSettings: readSettings,
  });
  const dictationService = createDictationService({
    dictationSessionRepository,
    dictationSelectionRepository,
    wordRepository,
  });
  const libraryService = createLibraryService({
    wordRepository,
    bookRepository,
  });
  const booksService = createBooksService({
    bookRepository,
  });
  const importController = createImportController({
    importService,
    readJsonBody,
    sendJson,
  });
  const dictationController = createDictationController({
    dictationService,
    readJsonBody,
    sendJson,
  });
  const libraryController = createLibraryController({
    libraryService,
    readJsonBody,
    sendJson,
  });
  const booksController = createBooksController({
    booksService,
    readJsonBody,
    sendJson,
  });
  const importRoutes = createImportRoutes({ importController });
  const dictationRoutes = createDictationRoutes({ dictationController });
  const libraryRoutes = createLibraryRoutes({ libraryController });
  const booksRoutes = createBooksRoutes({ booksController });

  const server = http.createServer(async (request, response) => {
    try {
      response.setHeader("Access-Control-Allow-Origin", "*");
      response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
      response.setHeader("Access-Control-Allow-Headers", "Content-Type");

      const url = new URL(request.url, `http://${request.headers.host}`);

      if (request.method === "OPTIONS") {
        return send(response, 204, "");
      }

      if (url.pathname.startsWith("/api/")) {
        return handleApi(request, response, url, importRoutes, dictationRoutes, libraryRoutes, booksRoutes);
      }

      return serveStatic(response, url.pathname);
    } catch (error) {
      return sendJson(response, 500, { error: error.message || "服务器异常" });
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`HearWords server running at http://${HOST}:${PORT}`);
  });
}

async function handleApi(request, response, url, importRoutes, dictationRoutes, libraryRoutes, booksRoutes) {
  if (await importRoutes.handle(request, response, url)) {
    return;
  }
  if (await dictationRoutes.handle(request, response, url)) {
    return;
  }
  if (await libraryRoutes.handle(request, response, url)) {
    return;
  }
  if (await booksRoutes.handle(request, response, url)) {
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/health") {
    const library = await wordRepository.listLibraryEntries();
    return sendJson(response, 200, {
      ok: true,
      now: Date.now(),
      stats: buildStats(library),
      dictionaryReady: (await getDictionaryCount()) > 0,
    });
  }

  if (request.method === "GET" && url.pathname === "/api/settings") {
    const settings = readSettings();
    return sendJson(response, 200, {
      ...safeSettings(settings),
      hasApiKey: Boolean(settings.oneApi.apiKey),
      hasPaddleToken: Boolean(settings.paddleOcr?.token),
    });
  }

  if (request.method === "POST" && url.pathname === "/api/settings") {
    const body = await readJsonBody(request);
    const settings = readSettings();
    const next = {
      ...settings,
      oneApi: {
        enabled: Boolean(body.oneApi?.enabled),
        baseUrl: (body.oneApi?.baseUrl || "").trim(),
        model: (body.oneApi?.model || "").trim(),
        apiKey: typeof body.oneApi?.apiKey === "string" && body.oneApi.apiKey.trim()
          ? body.oneApi.apiKey.trim()
          : settings.oneApi.apiKey,
        systemPrompt: (body.oneApi?.systemPrompt || settings.oneApi.systemPrompt || "").trim(),
        timeoutMs: clamp(Number(body.oneApi?.timeoutMs) || settings.oneApi.timeoutMs || 10000, 2000, 60000),
      },
      paddleOcr: {
        enabled: Boolean(body.paddleOcr?.enabled),
        apiUrl: (body.paddleOcr?.apiUrl || settings.paddleOcr?.apiUrl || process.env.PADDLE_OCR_API_URL || "").trim(),
        token: typeof body.paddleOcr?.token === "string" && body.paddleOcr.token.trim()
          ? body.paddleOcr.token.trim()
          : (settings.paddleOcr?.token || process.env.PADDLE_OCR_TOKEN || ""),
        timeoutMs: clamp(Number(body.paddleOcr?.timeoutMs) || settings.paddleOcr?.timeoutMs || 30000, 2000, 120000),
      },
      import: {
        parseLimitMax: clamp(
          Number(body.import?.parseLimitMax) || Number(settings.import?.parseLimitMax) || 2000,
          10,
          20000,
        ),
      },
      updatedAt: Date.now(),
    };
    writeJson(SETTINGS_PATH, next);
    return sendJson(response, 200, {
      message: "设置已保存。",
      settings: {
        ...safeSettings(next),
        hasApiKey: Boolean(next.oneApi.apiKey),
        hasPaddleToken: Boolean(next.paddleOcr?.token),
      },
    });
  }

  if (request.method === "GET" && url.pathname === "/api/history") {
    return sendJson(response, 200, {
      items: await getParseHistory(30),
    });
  }

  if (false && request.method === "GET" && url.pathname === "/api/library") {
    const library = await getLibrary();
    return sendJson(response, 200, {
      items: library,
      stats: buildStats(library),
      sources: buildSourceOptions(library),
    });
  }

  if (false && request.method === "PATCH" && url.pathname.startsWith("/api/library/")) {
    const id = decodeURIComponent(url.pathname.replace("/api/library/", ""));
    const body = await readJsonBody(request);
    const library = await getLibrary();
    const target = library.find((entry) => entry.id === id);
    if (!target) {
      return sendJson(response, 404, { error: "单词不存在。" });
    }

    target.definition = typeof body.definition === "string" ? body.definition.trim() : target.definition;
    target.exampleSentence = typeof body.exampleSentence === "string" ? body.exampleSentence.trim() : target.exampleSentence;
    target.updatedAt = Date.now();
    await upsertLibraryEntry(target);
    const nextLibrary = await getLibrary();
    return sendJson(response, 200, {
      message: "单词已更新。",
      item: nextLibrary.find((entry) => entry.id === id),
      items: nextLibrary,
      stats: buildStats(nextLibrary),
      sources: buildSourceOptions(nextLibrary),
    });
  }

  if (false && request.method === "DELETE" && url.pathname.startsWith("/api/library/")) {
    const id = decodeURIComponent(url.pathname.replace("/api/library/", ""));
    await deleteLibraryEntry(id);
    const library = await getLibrary();
    return sendJson(response, 200, {
      message: "单词已删除。",
      items: library,
      stats: buildStats(library),
      sources: buildSourceOptions(library),
    });
  }

  return sendJson(response, 404, { error: "接口不存在。" });
}

function buildStats(library) {
  const now = Date.now();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  return {
    totalWords: library.length,
    dueWords: library.filter((entry) => entry.nextReviewTime <= now).length,
    todayWords: library.filter((entry) => entry.createdAt >= startOfDay.getTime()).length,
  };
}

function buildSourceOptions(library) {
  const map = new Map();
  library.forEach((item) => {
    const key = `${item.bookName || "未命名词书"}|${item.sourceName || "manual-input"}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        bookName: item.bookName || "未命名词书",
        sourceName: item.sourceName || "manual-input",
      });
    }
  });
  return [...map.values()];
}

function safeSettings(settings) {
  return {
    oneApi: {
      enabled: Boolean(settings.oneApi.enabled),
      baseUrl: settings.oneApi.baseUrl || "",
      model: settings.oneApi.model || "",
      timeoutMs: settings.oneApi.timeoutMs || 10000,
      systemPrompt: settings.oneApi.systemPrompt || "",
    },
    paddleOcr: {
      enabled: Boolean(settings.paddleOcr?.enabled),
      apiUrl: settings.paddleOcr?.apiUrl || "",
      timeoutMs: settings.paddleOcr?.timeoutMs || 30000,
    },
    import: {
      parseLimitMax: clamp(Number(settings.import?.parseLimitMax) || 2000, 10, 20000),
    },
    updatedAt: settings.updatedAt || Date.now(),
  };
}

function ensureSettingsFile() {
  if (!fs.existsSync(SETTINGS_PATH)) {
    writeJson(SETTINGS_PATH, {
      oneApi: {
        enabled: false,
        baseUrl: process.env.ONE_API_BASE_URL || "",
        model: process.env.ONE_API_MODEL || "",
        apiKey: process.env.ONE_API_KEY || "",
        systemPrompt: "",
        timeoutMs: 10000,
      },
      paddleOcr: {
        enabled: Boolean(process.env.PADDLE_OCR_TOKEN),
        apiUrl: process.env.PADDLE_OCR_API_URL || "",
        token: process.env.PADDLE_OCR_TOKEN || "",
        timeoutMs: 30000,
      },
      import: {
        parseLimitMax: clamp(Number(process.env.IMPORT_PARSE_LIMIT_MAX) || 2000, 10, 20000),
      },
      updatedAt: Date.now(),
    });
  }
}

function readSettings() {
  return readJson(SETTINGS_PATH, {
    oneApi: {
      enabled: false,
      baseUrl: "",
      model: "",
      apiKey: "",
      systemPrompt: "",
      timeoutMs: 10000,
    },
    paddleOcr: {
      enabled: false,
      apiUrl: "",
      token: "",
      timeoutMs: 30000,
    },
    import: {
      parseLimitMax: clamp(Number(process.env.IMPORT_PARSE_LIMIT_MAX) || 2000, 10, 20000),
    },
    updatedAt: Date.now(),
  });
}

function readJson(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 20 * 1024 * 1024) {
        reject(new Error("请求体过大。"));
      }
    });
    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("请求 JSON 无法解析。"));
      }
    });
    request.on("error", reject);
  });
}

function serveStatic(response, pathname) {
  const relative = STATIC_FILES[pathname];
  if (!relative) {
    return send(response, 404, "Not Found", "text/plain; charset=utf-8");
  }
  const filePath = path.join(ROOT_DIR, relative);
  if (!fs.existsSync(filePath)) {
    return send(response, 404, "Not Found", "text/plain; charset=utf-8");
  }
  const ext = path.extname(filePath);
  return send(response, 200, fs.readFileSync(filePath), MIME_TYPES[ext] || "application/octet-stream");
}

function sendJson(response, statusCode, payload) {
  return send(response, statusCode, JSON.stringify(payload), MIME_TYPES[".json"]);
}

function send(response, statusCode, payload, contentType = "text/plain; charset=utf-8") {
  response.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  response.end(payload);
}

function buildDiff(answer, target) {
  const maxLength = Math.max(answer.length, target.length);
  const chunks = [];
  for (let index = 0; index < maxLength; index += 1) {
    const expected = target[index] || "";
    const actual = answer[index] || "";
    if (expected === actual) {
      chunks.push(expected);
    } else {
      chunks.push(`[${actual || "_"}→${expected || "_"}]`);
    }
  }
  return `${chunks.join("")}，正确答案是 ${target}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

module.exports = {};
