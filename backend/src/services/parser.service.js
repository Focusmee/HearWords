const path = require("node:path");
const { extractDocumentText } = require("../../document-parsers");

function createParserService({ textProcessingService }) {
  return {
    async extractDocumentContent(buffer, filename) {
      const text = await extractDocumentText(buffer, filename);
      const normalizedText = textProcessingService.normalizeImportedDocumentText(text);

      return {
        text: normalizedText,
        sourceName: filename,
        documentType: path.extname(filename).replace(/^\./, "").toLowerCase(),
        characterCount: normalizedText.length,
      };
    },
  };
}

module.exports = {
  createParserService,
};
