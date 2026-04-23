const {
  extractVocabularyEntries,
  lemmatize,
  normalizeDocumentText,
  prepareTextForParsing,
  POS_STOPWORDS,
} = require("../../text-processing");

function normalizeImportedDocumentText(text) {
  return normalizeDocumentText(text);
}

function prepareImportText(text) {
  return prepareTextForParsing(text);
}

function extractImportVocabularyEntries(text, options) {
  return extractVocabularyEntries(text, options);
}

function lemmatizeWord(word) {
  return lemmatize(word);
}

function isPosStopword(word) {
  return POS_STOPWORDS.has(word);
}

module.exports = {
  normalizeImportedDocumentText,
  prepareImportText,
  extractImportVocabularyEntries,
  lemmatizeWord,
  isPosStopword,
};
