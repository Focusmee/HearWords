# HearWords

HearWords 是一个本地优先的英语词汇学习 Web 应用，支持从文本/文档/OCR 提取候选词，并选择性导入到词库。

## 目录结构

- `backend/` Node.js + SQLite 后端（API 在 `http://127.0.0.1:3000`）
- `frontend/` Vue 3 + Vite 前端（开发端口默认 `5173`，已代理 `/api` 到后端）
- `docs/` 接口与联调文档

## 快速开始

### 后端

```bash
npm -C backend install
npm -C backend run setup:dictionary
npm -C backend start
```

### 前端

```bash
npm -C frontend install
npm -C frontend run dev
```

Import 联调说明见：`docs/IMPORT_INTEGRATION.md`

