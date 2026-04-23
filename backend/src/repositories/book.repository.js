const { all } = require("../../db");

const DEFAULT_BOOK_NAME = "未命名词书";
const DEFAULT_SOURCE_NAME = "manual-input";

async function listLibraryBooks() {
  const rows = await all(
    `
      SELECT DISTINCT
        book_name AS bookName,
        source_name AS sourceName
      FROM library_entries
      ORDER BY book_name ASC, source_name ASC
    `,
  );

  return rows.map((row) => {
    const bookName = row.bookName || DEFAULT_BOOK_NAME;
    const sourceName = row.sourceName || DEFAULT_SOURCE_NAME;
    return {
      key: `${bookName}|${sourceName}`,
      bookName,
      sourceName,
    };
  });
}

module.exports = {
  listLibraryBooks,
};

