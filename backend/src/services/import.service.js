const sharp = require("sharp");
const Tesseract = require("tesseract.js");
const engData = require("@tesseract.js-data/eng");
const { markdownToPlainText } = require("../utils/markdown");

function createImportService({
  parserService,
  paddleOcrService,
  textProcessingService,
  wordRepository,
  getSettings,
}) {
  return {
    async recognizeImage({ imageBase64 }) {
      const normalizedImageBase64 = String(imageBase64 || "");
      if (!normalizedImageBase64) {
        throw createHttpError(400, "缺少图片内容。");
      }

      const settings = getSettings();
      const canUsePaddle = Boolean(
        settings?.paddleOcr?.enabled &&
        (settings.paddleOcr.token || process.env.PADDLE_OCR_TOKEN),
      );
      if (canUsePaddle && paddleOcrService) {
        const markdownResult = await paddleOcrService.layoutParseToMarkdown({
          filename: "image",
          fileBase64: normalizedImageBase64,
          fileType: 1,
        });
        return {
          text: markdownToPlainText(markdownResult.markdown),
          confidence: 0,
          preprocessing: { angle: 0, width: 0, height: 0 },
          provider: "paddle-ocr",
        };
      }

      const buffer = Buffer.from(normalizedImageBase64, "base64");
      const preprocessed = await preprocessForOcr(buffer);
      const result = await Tesseract.recognize(preprocessed.buffer, "eng", {
        langPath: engData.langPath,
        gzip: engData.gzip,
      });

      return {
        text: result.data.text || "",
        confidence: result.data.confidence || 0,
        preprocessing: {
          angle: preprocessed.angle,
          width: preprocessed.width,
          height: preprocessed.height,
        },
        provider: "tesseract",
      };
    },

    async extractDocument({ filename, fileBase64 }) {
      const normalizedFilename = String(filename || "").trim();
      const normalizedFileBase64 = String(fileBase64 || "");

      if (!normalizedFilename || !normalizedFileBase64) {
        throw createHttpError(400, "缺少文档名或文档内容。");
      }

      const ext = normalizedFilename.toLowerCase().split(".").pop() || "";
      const settings = getSettings();
      const canUsePaddle = Boolean(
        settings?.paddleOcr?.enabled &&
        (settings.paddleOcr.token || process.env.PADDLE_OCR_TOKEN),
      );
      if (canUsePaddle && paddleOcrService && ext === "pdf") {
        const markdownResult = await paddleOcrService.layoutParseToMarkdown({
          filename: normalizedFilename,
          fileBase64: normalizedFileBase64,
          fileType: 0,
        });
        const text = textProcessingService.normalizeImportedDocumentText(markdownToPlainText(markdownResult.markdown));
        return {
          text,
          sourceName: normalizedFilename,
          documentType: ext,
          characterCount: text.length,
          provider: "paddle-ocr",
        };
      }

      return parserService.extractDocumentContent(
        Buffer.from(normalizedFileBase64, "base64"),
        normalizedFilename,
      );
    },

    async parseText({ text, sourceName, bookName, mode, limit }) {
      const normalizedText = String(text || "").trim();
      const normalizedSourceName = String(sourceName || "manual-input").trim();
      const normalizedBookName = String(bookName || "未命名词书").trim() || "未命名词书";
      
      const normalizedMode = mode === "enhanced" ? "enhanced" : "normal";
      const settings = getSettings();
      const parseLimitMax = clamp(Number(settings?.import?.parseLimitMax) || 2000, 10, 20000);
      const normalizedLimit = clamp(Number(limit) || 120, 10, parseLimitMax);

      if (!normalizedText) {
        throw createHttpError(400, "缺少待解析文本。");
      }

      const result = await parseImportText({
        text: normalizedText,
        sourceName: normalizedSourceName,
        mode: normalizedMode,
        limit: normalizedLimit,
        settings: getSettings(),
        textProcessingService,
        wordRepository,
      });

      await wordRepository.insertParseHistory({
        id: createId(),
        createdAt: Date.now(),
        sourceName: normalizedSourceName,
        bookName: normalizedBookName,
        mode: normalizedMode,
        llmUsed: result.llmUsed,
        warning: result.warning,
        fingerprint: hashText(normalizedText),
        candidateCount: result.candidates.length,
      });

      return result;
    },

    async importEntries({ entries }) {
      const normalizedEntries = Array.isArray(entries) ? entries : [];
      const settings = getSettings();
      const imported = await importWordsToLibrary({
        entries: normalizedEntries,
        wordRepository,
        settings,
      });
      const updatedLibrary = await wordRepository.listLibraryEntries();

      return {
        message: `词库已更新：新增词条 ${imported.addedWords} 个，更新词条 ${imported.updatedWords} 个，跳过 ${imported.skippedWords} 个。`,
        added: imported.addedWords,
        merged: imported.updatedWords,
        skipped: imported.skippedWords,
        duplicates: imported.duplicates,
        addedWords: imported.addedWords,
        updatedWords: imported.updatedWords,
        skippedWords: imported.skippedWords,
        items: updatedLibrary,
        stats: buildStats(updatedLibrary),
        sources: buildSourceOptions(updatedLibrary),
      };
    },
  };
}

async function parseImportText({
  text,
  sourceName,
  mode,
  limit,
  settings,
  textProcessingService,
  wordRepository,
}) {
  const normalResult = await parseWithDictionary({
    text,
    sourceName,
    limit,
    textProcessingService,
    wordRepository,
  });

  if (mode !== "enhanced") {
    const translated = await maybeTranslateCandidateDefinitionsToChinese({
      candidates: normalResult,
      settings,
    });
    const warning = translated.translated
      ? ""
      : `中文释义未生成：请在“设置”中配置 One-API，否则导入词库会被阻止。${buildDictionaryWarning()}`;

    return {
      mode: "normal",
      candidates: translated.candidates,
      llmUsed: translated.translated,
      warning,
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
    const enhanced = await parseWithOneApi({
      text,
      sourceName,
      settings,
      textProcessingService,
      wordRepository,
    });

    const translated = await maybeTranslateCandidateDefinitionsToChinese({
      candidates: enhanced.length ? enhanced : normalResult,
      settings,
    });

    return {
      mode: "enhanced",
      candidates: translated.candidates,
      llmUsed: true,
      warning: enhanced.length
        ? ""
        : `One-API 返回为空，已自动降级。${buildDictionaryWarning()}`,
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

async function parseWithDictionary({ text, sourceName, limit, textProcessingService, wordRepository }) {
  const fingerprint = hashText(text);
  const normalizedLimit = clamp(Number(limit) || 120, 10, 20000);
  const normalizedText = textProcessingService.normalizeImportedDocumentText(text);
  const ranked = textProcessingService.extractImportVocabularyEntries(normalizedText, {
    limit: normalizedLimit,
    glossaryLimit: normalizedLimit,
  });

  const dictionaryMap = wordRepository.findDictionaryEntriesByLemmas
    ? await wordRepository.findDictionaryEntriesByLemmas(ranked.map((entry) => entry.lemma))
    : null;

  const entries = [];
  for (const { rawWord, lemma, frequency, fromGlossary } of ranked) {
    const dictionaryMatches = dictionaryMap
      ? (dictionaryMap.get(lemma) || [])
      : await wordRepository.findDictionaryEntriesByLemma(lemma);
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
      bookName: "",
      frequency,
      fromGlossary: Boolean(fromGlossary),
      kept: true,
    });
  }

  return dedupeCandidates(entries);
}

async function parseWithOneApi({ text, sourceName, settings, textProcessingService, wordRepository }) {
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
    const response = await fetch(`${String(settings.oneApi.baseUrl || "").replace(/\/+$/, "")}/chat/completions`, {
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
      const lemma = textProcessingService.lemmatizeWord(String(item.lemma || item.rawWord || "").toLowerCase());
      if (!lemma || !/^[a-z-]+$/.test(lemma) || textProcessingService.isPosStopword(lemma)) {
        continue;
      }
      const dictionaryMatches = await wordRepository.findDictionaryEntriesByLemma(lemma);
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
        bookName: "",
        frequency: 1,
        kept: true,
      });
    }

    return dedupeCandidates(enriched);
  } finally {
    clearTimeout(timeout);
  }
}

async function mergeLibraryEntries({ library, entries, wordRepository }) {
  const map = new Map((library || []).map((item) => [item.lemma, item]));
  let added = 0;
  let merged = 0;
  let skipped = 0;
  const duplicates = [];
  const seen = new Set();
  const dictionaryMap = wordRepository.findDictionaryEntriesByLemmas
    ? await wordRepository.findDictionaryEntriesByLemmas((entries || []).map((entry) => entry?.lemma))
    : null;

  for (const entry of entries || []) {
    const lemma = String(entry.lemma || "").trim().toLowerCase();
    if (!lemma) {
      continue;
    }
    if (seen.has(lemma)) {
      continue;
    }
    seen.add(lemma);
    const dictionaryMatches = dictionaryMap
      ? (dictionaryMap.get(lemma) || [])
      : await wordRepository.findDictionaryEntriesByLemma(lemma);
    const primary = dictionaryMatches[0] || null;
    const existing = map.get(lemma);

    if (existing) {
      skipped += 1;
      duplicates.push(lemma);
      continue;
      existing.definition = primary?.definition || entry.definition || existing.definition;
      existing.pos = primary?.pos || existing.pos || "";
      existing.exampleSentence = primary?.exampleSentence || entry.exampleSentence || existing.exampleSentence || "";
      existing.lastSource = entry.sourceName || existing.lastSource || "";
      existing.originalForms = Array.from(new Set([...(existing.originalForms || []), entry.rawWord || lemma]));
      existing.updatedAt = Date.now();
      await wordRepository.saveLibraryEntry(existing);
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
      lastSource: entry.sourceName || "manual-input",
      originalForms: [entry.rawWord || lemma],
      masteryLevel: 0,
      failCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      nextReviewTime: Date.now(),
    };

    await wordRepository.saveLibraryEntry(item);
    map.set(lemma, item);
    added += 1;
  }

  return { added, merged, skipped, duplicates };
}

async function importWordsToLibrary({ entries, wordRepository, settings }) {
  let addedWords = 0;
  let updatedWords = 0;
  let skippedWords = 0;
  const duplicates = [];
  const duplicateSet = new Set();
  const seen = new Set();

  const dictionaryMap = wordRepository.findDictionaryEntriesByLemmas
    ? await wordRepository.findDictionaryEntriesByLemmas((entries || []).map((entry) => entry?.lemma))
    : null;

  const { translatedMap, missingChinese } = await ensureChineseDefinitionsForImport({
    entries,
    dictionaryMap,
    settings,
  });
  if (missingChinese.size) {
    const sample = [...missingChinese].slice(0, 20);
    throw createHttpError(
      400,
      `导入失败：以下单词缺少中文释义，请先在“设置”中配置 One-API 或手动提供中文释义：${sample.join("，")}${missingChinese.size > 20 ? "…" : ""}`,
    );
  }

  for (const entry of entries || []) {
    if (entry && entry.kept === false) {
      continue;
    }

    const lemma = String(entry?.lemma || "").trim().toLowerCase();
    if (!lemma) {
      continue;
    }

    if (seen.has(lemma)) {
      continue;
    }
    seen.add(lemma);

    const sourceName = String(entry?.sourceName || "manual-input").trim() || "manual-input";

    const dictionaryMatches = dictionaryMap
      ? (dictionaryMap.get(lemma) || [])
      : await wordRepository.findDictionaryEntriesByLemma(lemma);
    const primary = dictionaryMatches[0] || null;

    const enforcedDefinition = translatedMap.get(lemma) || "";
    const enforcedPos = primary?.pos || entry?.pos || "";

    const ensured = await wordRepository.ensureWordForImport({
      lemma,
      rawWord: entry?.rawWord || lemma,
      pos: enforcedPos,
      definition: enforcedDefinition,
      exampleSentence: primary?.exampleSentence || entry?.exampleSentence || "",
      sourceName,
    });

    if (ensured.created) {
      addedWords += 1;
    } else if (ensured.updated) {
      updatedWords += 1;
      if (!duplicateSet.has(lemma) && duplicates.length < 50) {
        duplicateSet.add(lemma);
        duplicates.push(lemma);
      }
    } else {
      skippedWords += 1;
      if (!duplicateSet.has(lemma) && duplicates.length < 50) {
        duplicateSet.add(lemma);
        duplicates.push(lemma);
      }
    }
  }

  return { addedWords, updatedWords, skippedWords, duplicates };
}

async function maybeTranslateCandidateDefinitionsToChinese({ candidates, settings }) {
  const items = Array.isArray(candidates) ? candidates : [];
  if (!items.length) return { candidates: items, translated: false };
  if (!canUseOneApi(settings)) return { candidates: items, translated: false };

  const need = items
    .filter((item) => item && item.definition && !hasChinese(item.definition))
    .map((item) => ({
      lemma: String(item.lemma || "").trim().toLowerCase(),
      pos: String(item.pos || "").trim(),
      definitionEn: String(item.definition || "").trim(),
    }))
    .filter((item) => item.lemma && item.definitionEn)
    .slice(0, 120);

  if (!need.length) return { candidates: items, translated: false };

  const map = await translateDefinitionsToChineseBatch({
    items: need,
    settings,
  });

  const next = items.map((item) => {
    const lemma = String(item?.lemma || "").trim().toLowerCase();
    const zh = map.get(lemma);
    if (zh && hasChinese(zh)) {
      return { ...item, definition: zh };
    }
    return item;
  });

  return { candidates: next, translated: true };
}

async function ensureChineseDefinitionsForImport({ entries, dictionaryMap, settings }) {
  const translatedMap = new Map();
  const missingChinese = new Set();

  const list = Array.isArray(entries) ? entries : [];
  if (!list.length) {
    return { translatedMap, missingChinese };
  }

  const needs = [];
  for (const entry of list) {
    if (entry && entry.kept === false) continue;
    const lemma = String(entry?.lemma || "").trim().toLowerCase();
    if (!lemma) continue;

    const dictionaryMatches = dictionaryMap ? (dictionaryMap.get(lemma) || []) : [];
    const primary = dictionaryMatches[0] || null;
    const entryDefinition = String(entry?.definition || "").trim();
    const primaryDefinition = String(primary?.definition || "").trim();

    if (entryDefinition && hasChinese(entryDefinition)) {
      translatedMap.set(lemma, entryDefinition);
      continue;
    }
    if (primaryDefinition && hasChinese(primaryDefinition)) {
      translatedMap.set(lemma, primaryDefinition);
      continue;
    }

    const baseEn = entryDefinition || primaryDefinition;
    if (!baseEn) {
      missingChinese.add(lemma);
      continue;
    }

    needs.push({
      lemma,
      pos: String(primary?.pos || entry?.pos || "").trim(),
      definitionEn: baseEn,
    });
  }

  if (!needs.length) {
    return { translatedMap, missingChinese };
  }

  if (!canUseOneApi(settings)) {
    for (const item of needs) missingChinese.add(item.lemma);
    return { translatedMap, missingChinese };
  }

  const map = await translateDefinitionsToChineseBatch({
    items: needs.slice(0, 2000),
    settings,
  });
  for (const item of needs) {
    const zh = map.get(item.lemma);
    if (zh && hasChinese(zh)) {
      translatedMap.set(item.lemma, zh);
    } else {
      missingChinese.add(item.lemma);
    }
  }

  return { translatedMap, missingChinese };
}

async function translateDefinitionsToChineseBatch({ items, settings }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), settings.oneApi.timeoutMs || 15000);

  const apiBase = String(settings.oneApi.baseUrl || "").replace(/\/+$/, "");

  const systemPrompt = [
    "You translate English dictionary glosses into concise Chinese meanings for learners.",
    "Return strict JSON with top-level key items: { items: [{ lemma, definitionZh }] }.",
    "definitionZh must be Chinese only, no English words, no IPA.",
    "Keep it short (<= 30 Chinese characters) and match common Chinese usage.",
    "If the English gloss is unclear, still output a reasonable Chinese meaning.",
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
          items: items.map((item) => ({
            lemma: item.lemma,
            pos: item.pos || "",
            definitionEn: item.definitionEn,
          })),
        }),
      },
    ],
  };

  try {
    const response = await fetch(`${apiBase}/chat/completions`, {
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
    const out = Array.isArray(parsed?.items) ? parsed.items : [];

    const map = new Map();
    for (const item of out) {
      const lemma = String(item?.lemma || "").trim().toLowerCase();
      const zh = String(item?.definitionZh || "").trim();
      if (lemma && zh) {
        map.set(lemma, zh);
      }
    }
    return map;
  } finally {
    clearTimeout(timeout);
  }
}

function hasChinese(text) {
  return /[\u4E00-\u9FFF]/.test(String(text || ""));
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

function hashText(text) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function createId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function canUseOneApi(settings) {
  return Boolean(
    settings.oneApi.enabled &&
    settings.oneApi.baseUrl &&
    settings.oneApi.model &&
    settings.oneApi.apiKey,
  );
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

module.exports = {
  createImportService,
};
