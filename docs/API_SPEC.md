# HearWords API Frozen Baseline

## 1. 文档目的

本文档用于冻结 HearWords 当前后端 API 合同，作为后端重构期间的现状基线。

适用范围：

- 以当前实现为准，不代表理想设计
- 不补充不存在的接口
- 不优化接口命名、结构或语义
- 仅描述当前前后端已经实际使用的合同

基线来源：

- 后端实现：[server.js](/D:/Projects/HearWords_Web/server.js:95)
- 数据结构来源：[db.js](/D:/Projects/HearWords_Web/db.js:54)
- 当前前端调用方：[app.js](/D:/Projects/HearWords_Web/app.js:294)

说明：

- 当前仓库中实际运行的页面入口是根目录 `index.html + app.js`
- `frontend/` 目录为规划中的 Vue 结构，不是本次“现状 API 合同”的调用依据
- “被前端哪个模块使用”按当前 `app.js` 中实际使用位置标记

---

## 2. 模块划分

本基线按业务模块标记接口归属：

- `Import`：导入、OCR、文档提取、文本解析、候选词入库
- `Library`：词书列表、单词编辑、单词删除
- `Dictation`：听写会话、答题、跳过
- `Support`：健康检查、设置、历史记录

---

## 3. 通用响应现状

当前后端并未使用统一的 `success/data/error` 包装，而是直接返回各接口自己的 JSON 结构。

错误现状：

- 请求失败时通常返回 `{ error: string }`
- 成功时返回各接口自定义字段

因此，重构期间应冻结“各接口当前返回字段”，而不是强行套统一响应壳。

---

## 4. 数据结构基线

以下为当前接口中重复出现的对象结构。

### 4.1 Stats

```json
{
  "totalWords": 0,
  "dueWords": 0,
  "todayWords": 0
}
```

### 4.2 Candidate

`/api/parse` 返回的候选词条对象。

```json
{
  "id": "string",
  "lemma": "string",
  "rawWord": "string",
  "phonetic": "string",
  "pos": "string",
  "definition": "string",
  "exampleSentence": "string",
  "sourceName": "string",
  "bookName": "string",
  "frequency": 1,
  "kept": true,
  "fromGlossary": true
}
```

说明：

- `fromGlossary` 只在词典解析路径中出现，One-API 增强解析结果中可能不存在

### 4.3 LibraryItem

词书条目对象，来自 `/api/library` 及相关接口。

```json
{
  "id": "string",
  "lemma": "string",
  "rawWord": "string",
  "phonetic": "string",
  "pos": "string",
  "definition": "string",
  "exampleSentence": "string",
  "sourceName": "string",
  "bookName": "string",
  "lastSource": "string",
  "originalForms": ["string"],
  "masteryLevel": 0,
  "failCount": 0,
  "createdAt": 0,
  "updatedAt": 0,
  "nextReviewTime": 0
}
```

### 4.4 SourceOption

`/api/library` 及相关接口返回的来源筛选对象。

```json
{
  "key": "bookName|sourceName",
  "bookName": "string",
  "sourceName": "string"
}
```

### 4.5 Session

听写会话对象。

```json
{
  "queue": ["word-id-1", "word-id-2"],
  "index": 0,
  "scope": "due",
  "updatedAt": 0
}
```

### 4.6 HistoryItem

解析历史对象。

```json
{
  "id": "string",
  "createdAt": 0,
  "sourceName": "string",
  "bookName": "string",
  "mode": "normal",
  "llmUsed": 0,
  "warning": "string",
  "fingerprint": "string",
  "candidateCount": 0
}
```

---

## 5. API 清单表

| URL | 方法 | 模块 | 核心主流程 | 可后续重构 | 请求参数 | 返回结构 |
|---|---|---|---|---|---|---|
| `/api/health` | `GET` | Support | 否 | 是 | 无 | `{ ok, now, stats: Stats, dictionaryReady }` |
| `/api/settings` | `GET` | Support | 否 | 是 | 无 | `{ oneApi: { enabled, baseUrl, model, timeoutMs, systemPrompt }, updatedAt, hasApiKey }` |
| `/api/settings` | `POST` | Support | 否 | 是 | `{ oneApi: { enabled, baseUrl, model, apiKey, systemPrompt, timeoutMs } }` | `{ message, settings: { oneApi: { enabled, baseUrl, model, timeoutMs, systemPrompt }, updatedAt, hasApiKey } }` |
| `/api/history` | `GET` | Support | 否 | 是 | 无 | `{ items: HistoryItem[] }` |
| `/api/ocr` | `POST` | Import | 是 | 否 | `{ imageBase64, filename }`，其中后端强依赖 `imageBase64` | `{ text, confidence, preprocessing: { angle, width, height } }` |
| `/api/extract-document` | `POST` | Import | 是 | 否 | `{ filename, fileBase64 }` | `{ text, sourceName, documentType, characterCount }` |
| `/api/parse` | `POST` | Import | 是 | 否 | `{ text, sourceName, bookName, mode }`，`mode` 当前只接受 `normal` / `enhanced` | `{ mode, candidates: Candidate[], llmUsed, warning }` |
| `/api/library` | `GET` | Library | 是 | 否 | 无 | `{ items: LibraryItem[], stats: Stats, sources: SourceOption[] }` |
| `/api/library/import` | `POST` | Import | 是 | 否 | `{ entries: Candidate[] }`，实际导入时重点读取 `lemma/rawWord/definition/exampleSentence/sourceName/bookName` | `{ message, added, merged, items: LibraryItem[], stats: Stats, sources: SourceOption[] }` |
| `/api/library/:id` | `PATCH` | Library | 否 | 是 | 路径参数 `id`；Body `{ definition?, exampleSentence? }` | `{ message, item: LibraryItem, items: LibraryItem[], stats: Stats, sources: SourceOption[] }` |
| `/api/library/:id` | `DELETE` | Library | 否 | 是 | 路径参数 `id` | `{ message, items: LibraryItem[], stats: Stats, sources: SourceOption[] }` |
| `/api/dictation/start` | `POST` | Dictation | 是 | 否 | `{ scope }`，当前只识别 `all`，其它值按 `due` 处理 | `{ message, finished, session: Session, current: LibraryItem \| null }` |
| `/api/dictation/session` | `GET` | Dictation | 是 | 否 | 无 | `{ finished, session: Session, current: LibraryItem \| null, message }` |
| `/api/dictation/session` | `DELETE` | Dictation | 否 | 是 | 无 | `{ message, finished: true, session: Session(空), current: null }` |
| `/api/dictation/check` | `POST` | Dictation | 是 | 否 | `{ answer }` | 正确时 `{ correct: true, expected, diff, finished, current, session, stats }`；错误时 `{ correct: false, expected, diff, finished: false, current, session, stats }` |
| `/api/dictation/skip` | `POST` | Dictation | 是 | 否 | 无 | `{ message, finished, current, session, stats }` |

---

## 6. 逐接口冻结说明

以下各节保留当前接口的请求与响应细节，作为重构时的对照基线。

### 6.1 `GET /api/health`

用途：

- 应用启动时检测后端是否可用
- 返回词书统计和词典就绪状态

前端使用：

- 启动检查
- 当前不归属 Import / Library / Dictation 主模块

请求参数：

- 无

成功响应：

```json
{
  "ok": true,
  "now": 1710000000000,
  "stats": {
    "totalWords": 120,
    "dueWords": 18,
    "todayWords": 4
  },
  "dictionaryReady": true
}
```

### 6.2 `GET /api/settings`

用途：

- 读取 One-API 配置

前端使用：

- 设置面板

请求参数：

- 无

成功响应：

```json
{
  "oneApi": {
    "enabled": false,
    "baseUrl": "",
    "model": "",
    "timeoutMs": 10000,
    "systemPrompt": ""
  },
  "updatedAt": 1710000000000,
  "hasApiKey": false
}
```

### 6.3 `POST /api/settings`

用途：

- 保存 One-API 配置

前端使用：

- 设置面板

请求参数：

```json
{
  "oneApi": {
    "enabled": true,
    "baseUrl": "https://example.com/v1/chat/completions",
    "model": "gpt-4o-mini",
    "apiKey": "sk-xxx",
    "systemPrompt": "string",
    "timeoutMs": 10000
  }
}
```

成功响应：

```json
{
  "message": "string",
  "settings": {
    "oneApi": {
      "enabled": true,
      "baseUrl": "string",
      "model": "string",
      "timeoutMs": 10000,
      "systemPrompt": "string"
    },
    "updatedAt": 1710000000000,
    "hasApiKey": true
  }
}
```

说明：

- 响应中不会回传 `apiKey`
- 如果请求未传新 `apiKey`，服务端会保留旧值

### 6.4 `GET /api/history`

用途：

- 获取最近解析历史

前端使用：

- 历史面板

请求参数：

- 无

成功响应：

```json
{
  "items": [
    {
      "id": "string",
      "createdAt": 1710000000000,
      "sourceName": "article.pdf",
      "bookName": "Book A",
      "mode": "enhanced",
      "llmUsed": 1,
      "warning": "",
      "fingerprint": "abc123",
      "candidateCount": 24
    }
  ]
}
```

### 6.5 `POST /api/ocr`

用途：

- 对图片内容进行 OCR

前端使用：

- `Import`

请求参数：

```json
{
  "imageBase64": "base64-string",
  "filename": "photo.png"
}
```

成功响应：

```json
{
  "text": "recognized text",
  "confidence": 92.3,
  "preprocessing": {
    "angle": 0,
    "width": 1200,
    "height": 800
  }
}
```

错误响应现状：

```json
{
  "error": "string"
}
```

### 6.6 `POST /api/extract-document`

用途：

- 提取 PDF / DOCX / XLSX 等文档文本

前端使用：

- `Import`

请求参数：

```json
{
  "filename": "lesson.pdf",
  "fileBase64": "base64-string"
}
```

成功响应：

```json
{
  "text": "document text",
  "sourceName": "lesson.pdf",
  "documentType": "pdf",
  "characterCount": 1024
}
```

### 6.7 `POST /api/parse`

用途：

- 将导入文本解析为候选词条

前端使用：

- `Import`

请求参数：

```json
{
  "text": "raw text",
  "sourceName": "article-1",
  "bookName": "Book A",
  "mode": "normal"
}
```

成功响应：

```json
{
  "mode": "normal",
  "candidates": [
    {
      "id": "hash:word",
      "lemma": "run",
      "rawWord": "running",
      "phonetic": "",
      "pos": "verb",
      "definition": "string",
      "exampleSentence": "string",
      "sourceName": "article-1",
      "bookName": "Book A",
      "frequency": 2,
      "kept": true,
      "fromGlossary": true
    }
  ],
  "llmUsed": false,
  "warning": "string"
}
```

说明：

- `mode=enhanced` 时，若 One-API 不可用或调用失败，接口仍返回 `200`，但会通过 `llmUsed=false` 和 `warning` 表示降级
- 候选词数组中的字段以当前实现为准，不应在重构时擅自删减

### 6.8 `GET /api/library`

用途：

- 获取完整词书列表、统计信息和来源筛选项

前端使用：

- `Library`
- `Dictation` 在答题后会重新拉取，用于刷新词书展示

请求参数：

- 无

成功响应：

```json
{
  "items": [
    {
      "id": "uuid",
      "lemma": "run",
      "rawWord": "running",
      "phonetic": "",
      "pos": "verb",
      "definition": "string",
      "exampleSentence": "string",
      "sourceName": "article-1",
      "bookName": "Book A",
      "lastSource": "article-1",
      "originalForms": ["running"],
      "masteryLevel": 0,
      "failCount": 0,
      "createdAt": 1710000000000,
      "updatedAt": 1710000000000,
      "nextReviewTime": 1710000000000
    }
  ],
  "stats": {
    "totalWords": 1,
    "dueWords": 1,
    "todayWords": 1
  },
  "sources": [
    {
      "key": "Book A|article-1",
      "bookName": "Book A",
      "sourceName": "article-1"
    }
  ]
}
```

### 6.8.1 `GET /api/library/books`

用途：

- 查询词书（按 `bookName/sourceName` 组合去重，用于筛选）

前端使用：
- `Library`

成功响应：
```json
{
  "items": [
    {
      "key": "Book A|manual-input",
      "bookName": "Book A",
      "sourceName": "manual-input"
    }
  ]
}
```

### 6.8.2 `GET /api/library/entries`

用途：

- 查询词条（分页 + 筛选 + 搜索）

前端使用：
- `Library`

请求参数（QueryString）：
- `page`：页码（从 1 开始）
- `pageSize`：每页条数
- `bookName`：按词书名筛选（可选）
- `sourceName`：按来源筛选（可选）
- `query`：全文搜索（可选，命中 `lemma/rawWord/definition`）

成功响应：
```json
{
  "items": [],
  "pagination": {
    "page": 1,
    "pageSize": 50,
    "total": 0
  }
}
```

### 6.9 `POST /api/library/import`

用途：

- 将候选词条写入词书

前端使用：

- `Import`

请求参数：

```json
{
  "entries": [
    {
      "lemma": "run",
      "rawWord": "running",
      "definition": "string",
      "exampleSentence": "string",
      "sourceName": "article-1",
      "bookName": "Book A"
    }
  ]
}
```

成功响应：

```json
{
  "message": "string",
  "added": 10,
  "merged": 4,
  "items": [],
  "stats": {
    "totalWords": 0,
    "dueWords": 0,
    "todayWords": 0
  },
  "sources": []
}
```

说明：

- 当前前端会将 `Candidate` 原样批量提交，服务端并不会严格校验所有字段
- 现阶段应冻结“可接受并已被前端提交的字段集合”

### 6.10 `PATCH /api/library/:id`

用途：

- 编辑词书中的释义和例句

前端使用：

- `Library`

请求参数：

- 路径参数：`id`

```json
{
  "definition": "new definition",
  "exampleSentence": "new example"
}
```

成功响应：

```json
{
  "message": "string",
  "item": {},
  "items": [],
  "stats": {
    "totalWords": 0,
    "dueWords": 0,
    "todayWords": 0
  },
  "sources": []
}
```

说明：

- 当前只更新 `definition` 和 `exampleSentence`
- 其它字段即使传入，现状也不会成为此接口的正式合同

### 6.11 `DELETE /api/library/:id`

用途：

- 删除词书条目

前端使用：

- `Library`

请求参数：

- 路径参数：`id`

成功响应：

```json
{
  "message": "string",
  "items": [],
  "stats": {
    "totalWords": 0,
    "dueWords": 0,
    "todayWords": 0
  },
  "sources": []
}
```

### 6.12 `POST /api/dictation/start`

用途：

- 启动一轮听写

前端使用：

- `Dictation`

请求参数：

```json
{
  "scope": "due"
}
```

成功响应：

```json
{
  "message": "string",
  "finished": false,
  "session": {
    "queue": ["id-1", "id-2"],
    "index": 0,
    "scope": "due",
    "updatedAt": 1710000000000
  },
  "current": {
    "id": "id-1",
    "lemma": "run"
  }
}
```

说明：

- `scope=all` 时取全部词
- 其它值现状下都会被归并成 `due`

### 6.13 `GET /api/dictation/session`

用途：

- 读取当前听写进度

前端使用：

- `Dictation`

请求参数：

- 无

成功响应：

```json
{
  "finished": false,
  "session": {
    "queue": ["id-1", "id-2"],
    "index": 0,
    "scope": "due",
    "updatedAt": 1710000000000
  },
  "current": {
    "id": "id-1",
    "lemma": "run"
  },
  "message": "string"
}
```

### 6.14 `DELETE /api/dictation/session`

用途：

- 清空当前听写会话

前端使用：

- `Dictation`

请求参数：

- 无

成功响应：

```json
{
  "message": "string",
  "finished": true,
  "session": {
    "queue": [],
    "index": 0,
    "scope": "due",
    "updatedAt": 0
  },
  "current": null
}
```

### 6.15 `POST /api/dictation/check`

用途：

- 校验当前单词听写答案，并更新复习进度

前端使用：

- `Dictation`

请求参数：

```json
{
  "answer": "running"
}
```

成功响应：答对

```json
{
  "correct": true,
  "expected": "run",
  "diff": "run",
  "finished": false,
  "current": {},
  "session": {
    "queue": [],
    "index": 0,
    "scope": "due",
    "updatedAt": 1710000000000
  },
  "stats": {
    "totalWords": 0,
    "dueWords": 0,
    "todayWords": 0
  }
}
```

成功响应：答错

```json
{
  "correct": false,
  "expected": "run",
  "diff": "[n→r][u→u][_→n]，正确答案是 run",
  "finished": false,
  "current": {},
  "session": {
    "queue": [],
    "index": 0,
    "scope": "due",
    "updatedAt": 1710000000000
  },
  "stats": {
    "totalWords": 0,
    "dueWords": 0,
    "todayWords": 0
  }
}
```

说明：

- 当前接口无论答对答错都返回 `200`
- 业务结果通过 `correct` 字段区分

### 6.16 `POST /api/dictation/skip`

用途：

- 跳过当前听写单词并推进会话

前端使用：

- `Dictation`

请求参数：

- 无

成功响应：

```json
{
  "message": "string",
  "finished": false,
  "current": {},
  "session": {
    "queue": [],
    "index": 0,
    "scope": "due",
    "updatedAt": 1710000000000
  },
  "stats": {
    "totalWords": 0,
    "dueWords": 0,
    "todayWords": 0
  }
}
```

---

## 7. 核心接口列表

以下接口属于 HearWords 当前核心主流程，应优先冻结：

### 7.1 Import 主流程

- `POST /api/ocr`
- `POST /api/extract-document`
- `POST /api/parse`
- `POST /api/library/import`

### 7.2 Library 主流程

- `GET /api/library`

### 7.3 Dictation 主流程

- `POST /api/dictation/start`
- `GET /api/dictation/session`
- `POST /api/dictation/check`
- `POST /api/dictation/skip`

---

## 8. 可后续重构接口

以下接口当前存在实际调用，但不属于主学习闭环，可在后续阶段再处理：

- `GET /api/health`
- `GET /api/settings`
- `POST /api/settings`
- `GET /api/history`
- `PATCH /api/library/:id`
- `DELETE /api/library/:id`
- `DELETE /api/dictation/session`

---

## 9. 建议冻结的接口字段

重构期间，以下字段建议视为“不可随意改名、删除、改语义”的冻结字段。

### 9.1 全局公共字段

- `stats.totalWords`
- `stats.dueWords`
- `stats.todayWords`
- `message`
- `error`

### 9.2 Import 相关

- `text`
- `confidence`
- `preprocessing.angle`
- `preprocessing.width`
- `preprocessing.height`
- `sourceName`
- `documentType`
- `characterCount`
- `mode`
- `candidates`
- `llmUsed`
- `warning`

### 9.3 Candidate 字段

- `id`
- `lemma`
- `rawWord`
- `phonetic`
- `pos`
- `definition`
- `exampleSentence`
- `sourceName`
- `bookName`
- `frequency`
- `kept`
- `fromGlossary`

### 9.4 LibraryItem 字段

- `id`
- `lemma`
- `rawWord`
- `phonetic`
- `pos`
- `definition`
- `exampleSentence`
- `sourceName`
- `bookName`
- `lastSource`
- `originalForms`
- `masteryLevel`
- `failCount`
- `createdAt`
- `updatedAt`
- `nextReviewTime`

### 9.5 SourceOption 字段

- `key`
- `bookName`
- `sourceName`

### 9.6 Dictation 字段

- `finished`
- `current`
- `session.queue`
- `session.index`
- `session.scope`
- `session.updatedAt`
- `correct`
- `expected`
- `diff`
- `stats`

### 9.7 Settings 字段

- `oneApi.enabled`
- `oneApi.baseUrl`
- `oneApi.model`
- `oneApi.timeoutMs`
- `oneApi.systemPrompt`
- `hasApiKey`

### 9.8 History 字段

- `items`
- `createdAt`
- `sourceName`
- `bookName`
- `mode`
- `llmUsed`
- `warning`
- `fingerprint`
- `candidateCount`

---

## 10. 冻结说明

在后端重构期间，以下变更默认不允许发生，除非同步更新文档并完成前端回归验证：

- 删除已有接口
- 修改 URL
- 修改请求方法
- 删除已有返回字段
- 修改已有字段名
- 修改已有字段语义
- 将当前 `200 + 业务字段` 的结果改为另一种结构而不做兼容

允许但需谨慎的变更：

- 在不破坏现有字段语义的前提下新增字段
- 在服务内部重构实现方式
- 在路由层、控制器层、服务层、仓储层之间重组代码

---

## 11. 备注

本文档是“当前合同冻结基线”，不是目标态设计文档。

如果后续进入 API 正式收敛阶段，建议在新文档中单独定义：

- 统一响应壳
- 统一错误码
- 统一分页协议
- 统一字段命名规则
- 前后端共享 schema
