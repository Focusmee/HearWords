const fs = require("node:fs");
const path = require("node:path");
const {
  initializeDatabase,
  replaceDictionaryEntries,
  getDictionaryCount,
} = require("../db");

const WORDNET_DIR = path.join(__dirname, "..", "node_modules", "wordnet-db", "dict");

async function main() {
  await initializeDatabase();

  const existingCount = await getDictionaryCount();
  if (existingCount > 100000) {
    console.log(`Dictionary already loaded: ${existingCount} entries`);
    return;
  }

  if (!fs.existsSync(WORDNET_DIR)) {
    throw new Error("wordnet-db dictionary files are missing. Run `npm install` first.");
  }

  console.log("Parsing WordNet database files...");
  const entries = loadEntriesFromWndb(WORDNET_DIR);
  console.log(`Loaded ${entries.length} dictionary rows, importing into SQLite...`);
  await replaceDictionaryEntries(entries);
  console.log("Dictionary setup complete.");
}

function loadEntriesFromWndb(directory) {
  const parts = [
    { index: "index.noun", data: "data.noun", type: "n" },
    { index: "index.verb", data: "data.verb", type: "v" },
    { index: "index.adj", data: "data.adj", type: "a" },
    { index: "index.adv", data: "data.adv", type: "r" },
  ];

  const allEntries = [];

  for (const part of parts) {
    const dataMap = buildDataMap(path.join(directory, part.data));
    const indexLines = fs.readFileSync(path.join(directory, part.index), "utf8").split(/\r?\n/);

    for (const line of indexLines) {
      if (!line || line.startsWith(" ")) {
        continue;
      }

      const segments = line.trim().split(/\s+/);
      if (segments.length < 6) {
        continue;
      }

      const lemma = segments[0].replace(/_/g, " ").toLowerCase();
      const synsetCount = Number(segments[2]);
      const pointerCount = Number(segments[3]);
      const offsetsStart = 6 + pointerCount;
      const offsets = segments.slice(offsetsStart, offsetsStart + synsetCount);

      offsets.forEach((offset, index) => {
        const synset = dataMap.get(offset);
        if (!synset) {
          return;
        }

        allEntries.push({
          lemma,
          pos: normalizePos(part.type),
          definition: synset.definition,
          exampleSentence: synset.exampleSentence,
          source: "WordNet 3.1 free database",
          rankOrder: index,
        });
      });
    }
  }

  return allEntries;
}

function buildDataMap(filePath) {
  const map = new Map();
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.startsWith(" ")) {
      continue;
    }

    const pipeIndex = line.indexOf("|");
    if (pipeIndex === -1) {
      continue;
    }

    const prefix = line.slice(0, pipeIndex).trim();
    const gloss = line.slice(pipeIndex + 1).trim();
    const offset = prefix.split(/\s+/)[0];
    if (!offset) {
      continue;
    }

    const parts = gloss.split("; ");
    const definition = (parts[0] || "").trim();
    const exampleSentence = parts.find((part) => /^"/.test(part))?.replace(/^"|"$/g, "") || "";

    map.set(offset, {
      definition,
      exampleSentence,
    });
  }
  return map;
}

function normalizePos(type) {
  if (type === "n") {
    return "n.";
  }
  if (type === "v") {
    return "v.";
  }
  if (type === "a") {
    return "adj.";
  }
  if (type === "r") {
    return "adv.";
  }
  return "";
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

