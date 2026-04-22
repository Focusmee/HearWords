const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");
const sharp = require("sharp");
const Tesseract = require("tesseract.js");
const engData = require("@tesseract.js-data/eng");
const { extractDocumentText } = require("./document-parsers");
const {
  extractVocabularyEntries,
  extractWordStats,
  lemmatize,
  normalizeDocumentText,
  prepareTextForParsing,
  splitSentences,
  POS_STOPWORDS,
} = require("./text-processing");
const {
  initializeDatabase,
  getLibrary,
  upsertLibraryEntry,
  deleteLibraryEntry,
  getDictionaryEntries,
  getDictionaryCount,
  addParseHistory,
  getParseHistory,
  setKv,
  getKv,
} = require("./db");

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

const REVIEW_STEPS = [
  10 * 60 * 1000,
  60 * 60 * 1000,
  8 * 60 * 60 * 1000,
  24 * 60 * 60 * 1000,
  3 * 24 * 60 * 60 * 1000,
  7 * 24 * 60 * 60 * 1000,
];

fs.mkdirSync(DATA_DIR, { recursive: true });
ensureSettingsFile();

bootstrap().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function bootstrap() {
  await initializeDatabase();

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, `http://${request.headers.host}`);

      if (request.method === "OPTIONS") {
        return send(response, 204, "");
      }

      if (url.pathname.startsWith("/api/")) {
        return handleApi(request, response, url);
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

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/health") {
    const library = await getLibrary();
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
      updatedAt: Date.now(),
    };
    writeJson(SETTINGS_PATH, next);
    return sendJson(response, 200, {
      message: "设置已保存。",
      settings: {
        ...safeSettings(next),
        hasApiKey: Boolean(next.oneApi.apiKey),
      },
    });
  }

  if (request.method === "GET" && url.pathname === "/api/history") {
    return sendJson(response, 200, {
      items: await getParseHistory(30),
    });
  }

  if (request.method === "POST" && url.pathname === "/api/ocr") {
    const body = await readJsonBody(request);
    const imageBase64 = String(body.imageBase64 || "");
    if (!imageBase64) {
      return sendJson(response, 400, { error: "缺少图片内容。" });
    }

    const buffer = Buffer.from(imageBase64, "base64");
    const preprocessed = await preprocessForOcr(buffer);
    const result = await Tesseract.recognize(preprocessed.buffer, "eng", {
      langPath: engData.langPath,
      gzip: engData.gzip,
    });
    return sendJson(response, 200, {
      text: result.data.text || "",
      confidence: result.data.confidence || 0,
      preprocessing: {
        angle: preprocessed.angle,
        width: preprocessed.width,
        height: preprocessed.height,
      },
    });
  }

  if (request.method === "POST" && url.pathname === "/api/extract-document") {
    const body = await readJsonBody(request);
    const filename = String(body.filename || "").trim();
    const fileBase64 = String(body.fileBase64 || "");

    if (!filename || !fileBase64) {
      return sendJson(response, 400, { error: "缺少文档名或文档内容。" });
    }

    const text = await extractDocumentText(Buffer.from(fileBase64, "base64"), filename);
    const normalizedText = normalizeDocumentText(text);
    return sendJson(response, 200, {
      text: normalizedText,
      sourceName: filename,
      documentType: path.extname(filename).replace(/^\./, "").toLowerCase(),
      characterCount: normalizedText.length,
    });
  }

  if (request.method === "POST" && url.pathname === "/api/parse") {
    const body = await readJsonBody(request);
    const text = (body.text || "").trim();
    const sourceName = (body.sourceName || "manual-input").trim();
    const bookName = (body.bookName || "未命名词书").trim();
    const mode = body.mode === "enhanced" ? "enhanced" : "normal";

    if (!text) {
      return sendJson(response, 400, { error: "缺少待解析文本。" });
    }

    const result = await parseText({
      text,
      sourceName,
      bookName,
      mode,
      settings: readSettings(),
    });

    await addParseHistory({
      id: createId(),
      createdAt: Date.now(),
      sourceName,
      bookName,
      mode,
      llmUsed: result.llmUsed,
      warning: result.warning,
      fingerprint: hashText(text),
      candidateCount: result.candidates.length,
    });

    return sendJson(response, 200, result);
  }

  if (request.method === "GET" && url.pathname === "/api/library") {
    const library = await getLibrary();
    return sendJson(response, 200, {
      items: library,
      stats: buildStats(library),
      sources: buildSourceOptions(library),
    });
  }

  if (request.method === "POST" && url.pathname === "/api/library/import") {
    const body = await readJsonBody(request);
    const entries = Array.isArray(body.entries) ? body.entries : [];
    const library = await getLibrary();
    const merged = await importEntries(library, entries);
    const updatedLibrary = await getLibrary();

    return sendJson(response, 200, {
      message: `单词书已更新：新增 ${merged.added} 个，合并 ${merged.merged} 个。`,
      added: merged.added,
      merged: merged.merged,
      items: updatedLibrary,
      stats: buildStats(updatedLibrary),
      sources: buildSourceOptions(updatedLibrary),
    });
  }

  if (request.method === "PATCH" && url.pathname.startsWith("/api/library/")) {
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

  if (request.method === "DELETE" && url.pathname.startsWith("/api/library/")) {
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

  if (request.method === "POST" && url.pathname === "/api/dictation/start") {
    const body = await readJsonBody(request);
    const scope = body.scope === "all" ? "all" : "due";
    const library = await getLibrary();
    const now = Date.now();
    const queue = library
      .filter((item) => scope === "all" || item.nextReviewTime <= now)
      .map((item) => item.id);

    const session = queue.length
      ? { queue, index: 0, scope, updatedAt: Date.now() }
      : emptySession();
    await saveSession(session);

    return sendJson(response, 200, {
      message: queue.length ? "已开始新的听写轮次。" : scope === "all" ? "单词书还是空的。" : "当前没有待复习单词。",
      finished: !queue.length,
      session,
      current: queue.length ? getCurrentSessionWord(library, session) : null,
    });
  }

  if (request.method === "GET" && url.pathname === "/api/dictation/session") {
    const session = await readSession();
    const library = await getLibrary();
    const current = getCurrentSessionWord(library, session);
    return sendJson(response, 200, {
      finished: !current,
      session,
      current,
      message: current ? "已恢复听写进度。" : "当前没有进行中的听写轮次。",
    });
  }

  if (request.method === "DELETE" && url.pathname === "/api/dictation/session") {
    await saveSession(emptySession());
    return sendJson(response, 200, {
      message: "听写进度已重置。",
      finished: true,
      session: emptySession(),
      current: null,
    });
  }

  if (request.method === "POST" && url.pathname === "/api/dictation/check") {
    const body = await readJsonBody(request);
    const answer = String(body.answer || "").trim().toLowerCase();
    const session = await readSession();
    const library = await getLibrary();
    const current = getCurrentSessionWord(library, session);

    if (!current) {
      return sendJson(response, 400, { error: "当前没有进行中的听写。" });
    }
    if (!answer) {
      return sendJson(response, 400, { error: "请输入答案。" });
    }

    const correct = answer === current.lemma.toLowerCase();
    if (correct) {
      const nextLevel = Math.min(5, current.masteryLevel + 1);
      current.masteryLevel = nextLevel;
      current.nextReviewTime = Date.now() + REVIEW_STEPS[Math.max(0, nextLevel - 1)];
      current.updatedAt = Date.now();
      await upsertLibraryEntry(current);
      session.index += 1;
      session.updatedAt = Date.now();
      const normalizedSession = normalizeSession(session);
      await saveSession(normalizedSession);
      const nextLibrary = await getLibrary();
      const nextWord = getCurrentSessionWord(nextLibrary, normalizedSession);
      return sendJson(response, 200, {
        correct: true,
        expected: current.lemma,
        diff: current.lemma,
        finished: !nextWord,
        current: nextWord,
        session: normalizedSession,
        stats: buildStats(nextLibrary),
      });
    }

    current.failCount += 1;
    current.masteryLevel = Math.max(0, current.masteryLevel - 1);
    current.nextReviewTime = Date.now() + REVIEW_STEPS[0];
    current.updatedAt = Date.now();
    await upsertLibraryEntry(current);
    const nextLibrary = await getLibrary();
    return sendJson(response, 200, {
      correct: false,
      expected: current.lemma,
      diff: buildDiff(answer, current.lemma),
      finished: false,
      current,
      session,
      stats: buildStats(nextLibrary),
    });
  }

  if (request.method === "POST" && url.pathname === "/api/dictation/skip") {
    const session = await readSession();
    const library = await getLibrary();
    const current = getCurrentSessionWord(library, session);

    if (!current) {
      return sendJson(response, 400, { error: "当前没有进行中的听写。" });
    }

    current.failCount += 1;
    current.nextReviewTime = Date.now() + REVIEW_STEPS[0];
    current.updatedAt = Date.now();
    await upsertLibraryEntry(current);
    session.index += 1;
    session.updatedAt = Date.now();
    const normalizedSession = normalizeSession(session);
    await saveSession(normalizedSession);
    const nextLibrary = await getLibrary();
    const nextWord = getCurrentSessionWord(nextLibrary, normalizedSession);

    return sendJson(response, 200, {
      message: "已跳过当前单词。",
      finished: !nextWord,
      current: nextWord,
      session: normalizedSession,
      stats: buildStats(nextLibrary),
    });
  }

  return sendJson(response, 404, { error: "接口不存在。" });
}

async function parseText({ text, sourceName, bookName, mode, settings }) {
  const normalResult = await parseWithDictionary(text, sourceName, bookName);

  if (mode !== "enhanced") {
    return {
      mode: "normal",
      candidates: normalResult,
      llmUsed: false,
      warning: buildDictionaryWarning(),
    };
  }

  if (!canUseOneApi(settings)) {
    return {
      mode: "enhanced",
      candidates: normalResult,
      llmUsed: false,
      warning: `One-API 未配置完成，已自动降级为普通解析。${buildDictionaryWarning()}`,
    };
  }

  try {
    const enhanced = await parseWithOneApi(text, sourceName, bookName, settings);
    return {
      mode: "enhanced",
      candidates: enhanced.length ? enhanced : normalResult,
      llmUsed: true,
      warning: enhanced.length ? "" : `One-API 返回为空，已自动降级。${buildDictionaryWarning()}`,
    };
  } catch (error) {
    return {
      mode: "enhanced",
      candidates: normalResult,
      llmUsed: false,
      warning: `One-API 调用失败，已自动降级：${error.message} ${buildDictionaryWarning()}`.trim(),
    };
  }
}

async function parseWithDictionary(text, sourceName, bookName) {
  const fingerprint = hashText(text);
  const cleanedText = prepareTextForParsing(text);
  const ranked = extractVocabularyEntries(cleanedText, { limit: 120, glossaryLimit: 5000 });

  const entries = [];
  for (const { rawWord, lemma, frequency, fromGlossary } of ranked) {
    const dictionaryMatches = await getDictionaryEntries(lemma);
    const primary = dictionaryMatches[0] || null;
    entries.push({
      id: `${fingerprint}:${lemma}`,
      lemma,
      rawWord,
      phonetic: "",
      pos: primary?.pos || "",
      definition: primary?.definition || `词典未收录 "${lemma}"，待手动补充释义`,
      exampleSentence: primary?.exampleSentence || "",
      sourceName,
      bookName,
      frequency,
      fromGlossary: Boolean(fromGlossary),
      kept: true,
    });
  }

  return dedupeCandidates(entries);
}

async function parseWithOneApi(text, sourceName, bookName, settings) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), settings.oneApi.timeoutMs);
  const systemPrompt = settings.oneApi.systemPrompt || [
    "Extract useful English vocabulary from the user's text.",
    "Return strict JSON with top-level key items.",
    "Each item must include lemma, rawWord, exampleSentence.",
    "Do not invent definitions or parts of speech.",
    "Definitions and parts of speech will be resolved by the server from a dictionary.",
  ].join(" ");

  const payload = {
    model: settings.oneApi.model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: JSON.stringify({
          sourceName,
          text,
          requirements: {
            limit: 80,
            schema: {
              items: [
                {
                  lemma: "run",
                  rawWord: "running",
                  exampleSentence: "Running every day builds discipline.",
                },
              ],
            },
          },
        }),
      },
    ],
  };

  try {
    const response = await fetch(`${settings.oneApi.baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.oneApi.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const textBody = await response.text();
      throw new Error(`HTTP ${response.status}: ${textBody.slice(0, 160)}`);
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;
    const parsed = parseJsonContent(content);
    const items = Array.isArray(parsed?.items) ? parsed.items : [];
    const enriched = [];

    for (const item of items) {
      const lemma = lemmatize(String(item.lemma || item.rawWord || "").toLowerCase());
      if (!lemma || !/^[a-z-]+$/.test(lemma) || POS_STOPWORDS.has(lemma)) {
        continue;
      }
      const dictionaryMatches = await getDictionaryEntries(lemma);
      const primary = dictionaryMatches[0] || null;
      enriched.push({
        id: `${hashText(text)}:${lemma}`,
        lemma,
        rawWord: String(item.rawWord || item.lemma || "").toLowerCase(),
        phonetic: "",
        pos: primary?.pos || "",
        definition: primary?.definition || `词典未收录 "${lemma}"，待手动补充释义`,
        exampleSentence: primary?.exampleSentence || String(item.exampleSentence || "").trim(),
        sourceName,
        bookName,
        frequency: 1,
        kept: true,
      });
    }

    return dedupeCandidates(enriched);
  } finally {
    clearTimeout(timeout);
  }
}

async function importEntries(library, entries) {
  const map = new Map(library.map((item) => [item.lemma, item]));
  let added = 0;
  let merged = 0;

  for (const entry of entries) {
    const lemma = String(entry.lemma || "").trim().toLowerCase();
    if (!lemma) {
      continue;
    }
    const dictionaryMatches = await getDictionaryEntries(lemma);
    const primary = dictionaryMatches[0] || null;
    const existing = map.get(lemma);

    if (existing) {
      existing.definition = primary?.definition || entry.definition || existing.definition;
      existing.pos = primary?.pos || existing.pos || "";
      existing.exampleSentence = primary?.exampleSentence || entry.exampleSentence || existing.exampleSentence || "";
      existing.lastSource = entry.sourceName || existing.lastSource || "";
      existing.bookName = entry.bookName || existing.bookName || "未命名词书";
      existing.originalForms = Array.from(new Set([...(existing.originalForms || []), entry.rawWord || lemma]));
      existing.updatedAt = Date.now();
      await upsertLibraryEntry(existing);
      merged += 1;
      continue;
    }

    const item = {
      id: createId(),
      lemma,
      rawWord: entry.rawWord || lemma,
      phonetic: "",
      pos: primary?.pos || "",
      definition: primary?.definition || entry.definition || `词典未收录 "${lemma}"，待手动补充释义`,
      exampleSentence: primary?.exampleSentence || entry.exampleSentence || "",
      sourceName: entry.sourceName || "manual-input",
      bookName: entry.bookName || "未命名词书",
      lastSource: entry.sourceName || "manual-input",
      originalForms: [entry.rawWord || lemma],
      masteryLevel: 0,
      failCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      nextReviewTime: Date.now(),
    };
    await upsertLibraryEntry(item);
    map.set(lemma, item);
    added += 1;
  }

  return { added, merged };
}

async function saveSession(session) {
  await setKv("dictation_session", JSON.stringify(session));
}

async function readSession() {
  const raw = await getKv("dictation_session");
  if (!raw) {
    return emptySession();
  }
  try {
    return normalizeSession(JSON.parse(raw));
  } catch {
    return emptySession();
  }
}

function emptySession() {
  return {
    queue: [],
    index: 0,
    scope: "due",
    updatedAt: 0,
  };
}

function normalizeSession(session) {
  if (!session || !Array.isArray(session.queue) || !session.queue.length) {
    return emptySession();
  }
  const index = clamp(Number(session.index) || 0, 0, session.queue.length);
  if (index >= session.queue.length) {
    return emptySession();
  }
  return {
    queue: session.queue,
    index,
    scope: session.scope === "all" ? "all" : "due",
    updatedAt: Number(session.updatedAt) || Date.now(),
  };
}

function getCurrentSessionWord(library, session) {
  const normalized = normalizeSession(session);
  if (!normalized.queue.length) {
    return null;
  }
  const id = normalized.queue[normalized.index];
  return library.find((entry) => entry.id === id) || null;
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

function dedupeCandidates(entries) {
  const map = new Map();
  entries.forEach((entry) => {
    const existing = map.get(entry.lemma);
    if (!existing || Number(entry.frequency || 0) > Number(existing.frequency || 0)) {
      map.set(entry.lemma, entry);
    }
  });
  return [...map.values()];
}

function findExampleSentence(sentences, word) {
  return sentences.find((sentence) => new RegExp(`\\b${escapeRegExp(word)}\\b`, "i").test(sentence)) || "";
}

function parseJsonContent(content) {
  if (typeof content === "object" && content) {
    return content;
  }
  if (typeof content !== "string") {
    throw new Error("LLM 返回内容为空。");
  }
  try {
    return JSON.parse(content);
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("LLM 返回了非 JSON 内容。");
    }
    return JSON.parse(content.slice(start, end + 1));
  }
}

function buildDictionaryWarning() {
  return "词性与释义来自 WordNet 免费词典查询，不再从图片或文本内容中推测。";
}

async function preprocessForOcr(buffer) {
  const expanded = await sharp(buffer)
    .rotate()
    .removeAlpha()
    .grayscale()
    .normalize()
    .resize({ width: 1800, withoutEnlargement: true })
    .toBuffer();

  const angle = await estimateDeskewAngle(expanded);
  const final = sharp(expanded)
    .rotate(angle, { background: { r: 255, g: 255, b: 255, alpha: 1 } })
    .grayscale()
    .normalize()
    .sharpen({ sigma: 1.1, m1: 1, m2: 2 })
    .threshold(178, { grayscale: true });

  const metadata = await final.metadata();
  return {
    buffer: await final.png().toBuffer(),
    angle,
    width: metadata.width || 0,
    height: metadata.height || 0,
  };
}

async function estimateDeskewAngle(buffer) {
  const candidates = [-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5];
  let bestAngle = 0;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const angle of candidates) {
    const { data, info } = await sharp(buffer)
      .rotate(angle, { background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .resize({ width: 800, withoutEnlargement: true })
      .grayscale()
      .normalize()
      .threshold(178, { grayscale: true })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const score = projectionVarianceScore(data, info.width, info.height);
    if (score > bestScore) {
      bestScore = score;
      bestAngle = angle;
    }
  }

  return bestAngle;
}

function projectionVarianceScore(data, width, height) {
  const sums = new Array(height).fill(0);
  for (let y = 0; y < height; y += 1) {
    let rowInk = 0;
    for (let x = 0; x < width; x += 1) {
      const value = data[(y * width) + x];
      rowInk += 255 - value;
    }
    sums[y] = rowInk;
  }

  const mean = sums.reduce((total, value) => total + value, 0) / Math.max(1, sums.length);
  return sums.reduce((total, value) => total + ((value - mean) ** 2), 0);
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
    updatedAt: settings.updatedAt || Date.now(),
  };
}

function canUseOneApi(settings) {
  return Boolean(
    settings.oneApi.enabled &&
    settings.oneApi.baseUrl &&
    settings.oneApi.model &&
    settings.oneApi.apiKey,
  );
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

function hashText(text) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
