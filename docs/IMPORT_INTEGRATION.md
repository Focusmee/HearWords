# Import 模块前后端联调说明

## 目标

把 `frontend` 的 Import 页面与 `backend` 的 Import API（OCR / 文档提取 / 解析 / 入库）打通，支持本地联调。

## 依赖与端口

- 后端：`http://127.0.0.1:3000`
- 前端（Vite）：`http://127.0.0.1:5173`
- 前端已在 `frontend/vite.config.js` 配置 dev proxy：`/api/*` → `http://127.0.0.1:3000`

## PaddleOCR（可选）

如果你有 PaddleOCR 的 `layout-parsing` API（适合 PDF/图片），后端会在以下场景优先使用它：

- 图片上传 → `POST /api/ocr`
- PDF 上传 → `POST /api/extract-document`

配置方式（二选一）：

1) 环境变量（推荐，不落盘）：

```bash
set PADDLE_OCR_API_URL=你的 layout-parsing API URL
set PADDLE_OCR_TOKEN=你的 token
```

2) 通过 `POST /api/settings` 写入 `backend/data/settings.json`：

```json
{
  "paddleOcr": {
    "enabled": true,
    "apiUrl": "你的 layout-parsing API URL",
    "token": "你的 token",
    "timeoutMs": 30000
  }
}
```

注意：接口响应不会回传 token，仅返回 `hasPaddleToken` 布尔值。

## 启动方式

### 1) 启动后端

```bash
npm -C backend install
npm -C backend run setup:dictionary
npm -C backend start
```

### 2) 启动前端

```bash
npm -C frontend install
npm -C frontend run dev
```

打开：`http://127.0.0.1:5173/#/import`

## Import 页面交互流程

1. 选择文件（`txt / pdf / doc / docx / png / jpg / jpeg`），或直接粘贴文本到“文本预览”
2. 如需可修改 `Source / Book / Mode`（`Book` 可直接输入新名称，或点“新建”快速创建）
3. 点击“解析候选词”（调用 `POST /api/parse`）
4. 勾选候选词，点击“保存到词库”（调用 `POST /api/library/import`）

提示：
- “候选数”会作为 `POST /api/parse` 的 `limit` 参数，控制本次解析返回多少个英文单词候选。
- “选前 N”会按 `frequency`（再按 `lemma`）一键勾选前 N 个候选词，便于按数量导入。
- “候选数”允许的最大值由后端 `settings.import.parseLimitMax` 控制（默认 2000，可在 `POST /api/settings` 或环境变量 `IMPORT_PARSE_LIMIT_MAX` 中修改）。
- 导入时会进行去重：已存在于词库的 lemma 会被跳过，并在前端提示重复词列表（最多展示前 12 个）。

## API 对接点（前端调用）

- OCR：`POST /api/ocr`，body `{ imageBase64, filename }`
- 文档提取：`POST /api/extract-document`，body `{ filename, fileBase64 }`
- 解析：`POST /api/parse`，body `{ text, sourceName, bookName, mode }`
- 入库：`POST /api/library/import`，body `{ entries }`

## 备注

- 后端 `readJsonBody` 有体积保护（默认约 20MB），大文件请先压缩/裁剪，或改为分片/上传式接口。
- 前端默认走 Vite proxy，不需要额外 CORS 配置；后端也已返回基础 CORS 响应头，便于直接跨域调用。
