# 数据模型升级迁移说明（words/books/book_words）

## 目标语义

- `words`：全库唯一词条（`lemma UNIQUE`），词条主字段（`pos/definition/exampleSentence/mastery/nextReviewTime/originalForms/...`）都归属此表。
- `books`：词书（类似标签/集合）。
- `book_words`：词条与词书的 N:M 关联（`PRIMARY KEY(book_id, word_id)`），用于实现“一个词可以属于多个词书”。

## 表结构（SQLite）

- `words(lemma UNIQUE)`
- `books(name UNIQUE)`
- `book_words(book_id, word_id UNIQUE)`（通过复合主键保证幂等）

额外字段：

- `words.last_source`：该词条“全局最近导入来源”（用于 `GET /api/library` 不带 `bookName` 时回填 `sourceName/lastSource`）。
- `book_words.last_source`：该词条在某词书下“最近一次导入来源”（用于 `GET /api/library?bookName=X` 回填 `sourceName/lastSource`）。
- `book_words.updated_at`：用于“默认词书”回填（最近关联的词书）。

## API 兼容回填规则

- `GET /api/library?bookName=X`
  - 仅返回属于词书 `X` 的词条
  - `item.bookName = X`
  - `item.sourceName/item.lastSource` 优先取 `book_words.last_source`，为空则回退 `words.last_source`，再为空则 `""`
- `GET /api/library`（不带 `bookName`）
  - `item.bookName` 回填为该词条关联的“默认词书”（规则：`book_words.updated_at` 最大的那本；无关联则 `未命名词书`）
  - `item.sourceName/item.lastSource` 回填为 `words.last_source`（或 `""`）
  - 额外字段：`item.bookNames: string[]`

## 迁移脚本

脚本位置：

- `D:\\Projects\\HearWords_Web\\backend\\scripts\\migrate-legacy-library.js`

执行：

```bash
npm -C backend start
# 或者只跑脚本（会自动 initializeDatabase）
node backend/scripts/migrate-legacy-library.js
```

### 合并策略（同 lemma 多条 legacy 记录）

迁移来源为 legacy 表 `library_entries`。当同一 `lemma` 存在多条记录时，脚本按以下稳定规则合并生成 `words`：

- `createdAt`：取最小值
- `updatedAt`：取最大值
- `nextReviewTime`：取最小值（保证最早到期不丢）
- `masteryLevel`：取最大值
- `failCount`：取最大值
- `rawWord/phonetic/pos/exampleSentence`：优先非空，若冲突则优先更长文本
- `definition`：优先非空且尽量避开“词典未收录/待手动补充”类占位文本，若冲突则优先更长文本
- `originalForms`：做 union 去重（包含 `lemma` 与 `rawWord`）
- `lastSource`：取 `updatedAt` 最大的那条记录的 `last_source/source_name`

关联迁移：

- 生成 `books`（按 `book_name` 去重）
- 生成 `book_words`（按 `(book_id, word_id)` 幂等；同 book + lemma 多条取 `updatedAt` 最大的一条作为 `book_words.last_source`）

