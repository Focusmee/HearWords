const path = require("node:path");
const { pathToFileURL } = require("node:url");
const AdmZip = require("adm-zip");

let pdfjsLibPromise = null;
const PDFJS_STANDARD_FONT_DATA_URL = `${pathToFileURL(path.join(path.dirname(require.resolve("pdfjs-dist/package.json")), "standard_fonts")).href}/`;

async function extractDocumentText(buffer, filename) {
  const extension = path.extname(filename || "").toLowerCase();
  if (extension === ".pdf") {
    return extractPdfText(buffer);
  }
  if (extension === ".docx") {
    return extractDocxText(buffer);
  }
  if (extension === ".xlsx") {
    return extractXlsxText(buffer);
  }
  throw new Error(`Unsupported document type: ${extension || "unknown"}`);
}

async function extractPdfText(buffer) {
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    useWorkerFetch: false,
    isEvalSupported: false,
    standardFontDataUrl: PDFJS_STANDARD_FONT_DATA_URL,
  });
  const document = await loadingTask.promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines = [];
    let currentLine = [];
    let lastY = null;

    for (const item of content.items || []) {
      if (!item || typeof item.str !== "string") {
        continue;
      }
      const text = item.str.trim();
      if (!text) {
        continue;
      }
      const y = Array.isArray(item.transform) ? Number(item.transform[5]) : null;
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2.5 && currentLine.length) {
        lines.push(currentLine.join(" ").trim());
        currentLine = [];
      }
      currentLine.push(text);
      lastY = y;
      if (item.hasEOL) {
        lines.push(currentLine.join(" ").trim());
        currentLine = [];
        lastY = null;
      }
    }

    if (currentLine.length) {
      lines.push(currentLine.join(" ").trim());
    }
    pages.push(lines.join("\n"));
  }

  await loadingTask.destroy();
  return pages.join("\n\n");
}

function extractDocxText(buffer) {
  const zip = new AdmZip(buffer);
  const xmlParts = zip.getEntries()
    .map((entry) => entry.entryName)
    .filter((name) => /^word\/(?:document|header\d+|footer\d+|footnotes|endnotes|comments)\.xml$/i.test(name))
    .sort();

  if (!xmlParts.length) {
    return "";
  }

  const chunks = xmlParts
    .map((name) => readZipText(zip, name))
    .filter(Boolean)
    .map(extractWordprocessingMlText)
    .filter(Boolean);

  return chunks.join("\n\n");
}

function extractXlsxText(buffer) {
  const zip = new AdmZip(buffer);
  const workbookXml = readZipText(zip, "xl/workbook.xml");
  if (!workbookXml) {
    return "";
  }

  const sharedStrings = parseSharedStrings(readZipText(zip, "xl/sharedStrings.xml"));
  const workbookRels = parseRelationships(readZipText(zip, "xl/_rels/workbook.xml.rels"));
  const sheets = parseWorkbookSheets(workbookXml);
  const chunks = [];

  for (const sheet of sheets) {
    const target = workbookRels.get(sheet.relationshipId);
    if (!target) {
      continue;
    }
    const entryName = normalizeZipPath("xl", target);
    const sheetXml = readZipText(zip, entryName);
    if (!sheetXml) {
      continue;
    }
    const sheetText = extractWorksheetText(sheetXml, sharedStrings);
    if (sheetText) {
      chunks.push(sheetText);
    }
  }

  return chunks.join("\n\n");
}

function parseSharedStrings(xml) {
  if (!xml) {
    return [];
  }
  const strings = [];
  const itemPattern = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
  let match = itemPattern.exec(xml);

  while (match) {
    strings.push(extractWordprocessingMlText(match[1]));
    match = itemPattern.exec(xml);
  }

  return strings;
}

function parseWorkbookSheets(xml) {
  const sheets = [];
  const pattern = /<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/>/gi;
  let match = pattern.exec(xml);

  while (match) {
    sheets.push({
      name: decodeXmlEntities(match[1]),
      relationshipId: match[2],
    });
    match = pattern.exec(xml);
  }

  return sheets;
}

function parseRelationships(xml) {
  const map = new Map();
  if (!xml) {
    return map;
  }

  const pattern = /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/>/gi;
  let match = pattern.exec(xml);

  while (match) {
    map.set(match[1], match[2]);
    match = pattern.exec(xml);
  }

  return map;
}

function extractWorksheetText(xml, sharedStrings) {
  const rows = [];
  const rowPattern = /<row\b[^>]*>([\s\S]*?)<\/row>/gi;
  let rowMatch = rowPattern.exec(xml);

  while (rowMatch) {
    const cells = [];
    const cellPattern = /<c\b([^>]*)>([\s\S]*?)<\/c>/gi;
    let cellMatch = cellPattern.exec(rowMatch[1]);

    while (cellMatch) {
      const attrs = cellMatch[1];
      const content = cellMatch[2];
      const type = /(?:^|\s)t="([^"]+)"/i.exec(attrs)?.[1] || "";
      const value = extractCellValue(content, type, sharedStrings);
      if (value) {
        cells.push(value);
      }
      cellMatch = cellPattern.exec(rowMatch[1]);
    }

    if (cells.length) {
      rows.push(cells.join(" | "));
    }
    rowMatch = rowPattern.exec(xml);
  }

  return rows.join("\n");
}

function extractCellValue(cellXml, type, sharedStrings) {
  if (type === "inlineStr") {
    return compactWhitespace(extractWordprocessingMlText(cellXml));
  }

  if (type === "s") {
    const index = Number(extractTagValue(cellXml, "v"));
    return Number.isInteger(index) ? compactWhitespace(sharedStrings[index] || "") : "";
  }

  if (type === "str") {
    return compactWhitespace(decodeXmlEntities(extractTagValue(cellXml, "v")));
  }

  if (type === "b") {
    const raw = extractTagValue(cellXml, "v");
    return raw === "1" ? "TRUE" : raw === "0" ? "FALSE" : "";
  }

  const formulaText = extractTagValue(cellXml, "f");
  const rawValue = extractTagValue(cellXml, "v");
  const text = compactWhitespace(decodeXmlEntities(rawValue));

  if (containsLetters(text)) {
    return text;
  }
  if (formulaText && containsLetters(formulaText)) {
    return compactWhitespace(decodeXmlEntities(formulaText));
  }
  return "";
}

function extractTagValue(xml, tagName) {
  const match = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i").exec(xml);
  return match ? match[1] : "";
}

function extractWordprocessingMlText(xml) {
  return compactWhitespace(
    decodeXmlEntities(
      xml
        .replace(/<w:tab\b[^>]*\/>/gi, "\t")
        .replace(/<w:br\b[^>]*\/>/gi, "\n")
        .replace(/<w:cr\b[^>]*\/>/gi, "\n")
        .replace(/<\/w:p>/gi, "\n")
        .replace(/<\/w:tr>/gi, "\n")
        .replace(/<\/w:tc>/gi, "\t")
        .replace(/<w:t\b[^>]*>/gi, "")
        .replace(/<\/w:t>/gi, "")
        .replace(/<[^>]+>/g, " "),
    ),
  );
}

function compactWhitespace(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function decodeXmlEntities(text) {
  return String(text || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function normalizeZipPath(...segments) {
  return segments
    .filter(Boolean)
    .join("/")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");
}

function readZipText(zip, entryName) {
  try {
    const entry = zip.getEntry(entryName);
    if (!entry) {
      return "";
    }
    return entry.getData().toString("utf8");
  } catch {
    return "";
  }
}

function containsLetters(text) {
  return /[A-Za-z]/.test(String(text || ""));
}

async function loadPdfJs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((module) => module.default || module);
  }
  return pdfjsLibPromise;
}

module.exports = {
  extractDocumentText,
};

