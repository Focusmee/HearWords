# HearWords 后端代码生成规范（Node 版）

## 1. 目标

本规范用于约束 AI 参与 HearWords 后端代码生成时的行为，确保后端代码具备以下特征：

- 路由、控制器、业务逻辑、数据访问分层清晰
- 单次改动范围可控
- 接口输入输出稳定
- 易于调试、维护、扩展
- 不因局部需求导致后端整体结构失控

本规范适用于当前 HearWords 后端的本地运行架构：

- Node.js
- SQLite
- 本地文件处理
- 文档解析与文本处理
- 单用户、本地优先

---

## 2. 总体原则

### 2.1 单次任务只允许修改一个业务域
后端任务必须围绕一个明确业务域展开，例如：

- import
- library
- dictation
- settings
- history
- parser
- review

禁止一句话同时要求 AI 重构多个核心业务域。

### 2.2 必须分层
后端代码必须拆分为：

- route：路由层
- controller：请求入口层
- service：业务逻辑层
- repository：数据访问层
- utils / middleware：公共能力层

禁止把全部逻辑堆积在 `server.js` 或单个入口文件中。

### 2.3 Controller 薄、Service 厚
Controller 只负责：

- 接收请求
- 解析参数
- 调用 service
- 返回响应

Service 负责：

- 核心业务流程
- 校验业务规则
- 协调 repository
- 处理异常分支

### 2.4 Repository 只做数据访问
Repository 层只负责：

- SQL 查询
- 数据插入、更新、删除
- 查询结果映射

Repository 不负责：

- HTTP 语义
- 业务规则判断
- 响应格式拼装

### 2.5 所有接口返回格式统一
统一结构：

```json
{
  "success": true,
  "data": {},
  "error": ""
}
```

禁止不同接口返回风格混乱。

### 2.6 错误处理必须统一
所有异常必须经过统一错误处理路径，不允许到处临时 `res.end('error')` 或返回不一致的字符串。

---

## 3. 推荐目录结构

```text
backend/
├─ src/
│  ├─ app.js
│  ├─ routes/
│  │  ├─ import.routes.js
│  │  ├─ library.routes.js
│  │  ├─ dictation.routes.js
│  │  ├─ settings.routes.js
│  │  └─ history.routes.js
│  ├─ controllers/
│  │  ├─ import.controller.js
│  │  ├─ library.controller.js
│  │  ├─ dictation.controller.js
│  │  ├─ settings.controller.js
│  │  └─ history.controller.js
│  ├─ services/
│  │  ├─ import.service.js
│  │  ├─ parser.service.js
│  │  ├─ text-processing.service.js
│  │  ├─ library.service.js
│  │  ├─ dictation.service.js
│  │  ├─ review.service.js
│  │  └─ settings.service.js
│  ├─ repositories/
│  │  ├─ word.repository.js
│  │  ├─ book.repository.js
│  │  ├─ history.repository.js
│  │  └─ settings.repository.js
│  ├─ db/
│  │  ├─ connection.js
│  │  ├─ migrations/
│  │  └─ seed/
│  ├─ middleware/
│  │  ├─ error-handler.js
│  │  ├─ request-logger.js
│  │  └─ validate-request.js
│  ├─ utils/
│  │  ├─ response.js
│  │  ├─ errors.js
│  │  └─ file.js
│  └─ config/
│     ├─ env.js
│     └─ constants.js
├─ scripts/
│  └─ setup-dictionary.js
└─ package.json
```

---

## 4. 文件职责规范

### 4.1 routes
职责：

- 注册路由
- 路由到 controller
- 不承载具体业务逻辑

要求：

- 一个业务域一个 route 文件
- 文件命名统一为 `xxx.routes.js`

禁止：

- 在 route 文件中写 SQL
- 在 route 文件中写复杂业务逻辑
- 在 route 文件中进行大量参数转换

### 4.2 controllers
职责：

- 接收请求参数
- 做基础参数校验
- 调用 service
- 统一返回结果

要求：

- controller 尽量短小
- 一个 controller 文件按业务域聚合
- 每个导出函数对应一个用例

禁止：

- 在 controller 中直接写 SQL
- 在 controller 中处理复杂文本解析
- 在 controller 中直接操作文件系统，除非非常轻量且明确

### 4.3 services
职责：

- 实现核心业务规则
- 编排多个 repository
- 调用 parser / text-processing
- 管理流程顺序与异常策略

要求：

- 一个 service 文件只处理一个业务域
- 函数命名必须体现动作
- 明确输入和输出

### 4.4 repositories
职责：

- 与数据库交互
- 执行 SQL
- 返回原始数据或轻量映射数据

要求：

- 一个 repository 负责一类资源
- SQL 语句集中在 repository 内
- 不在其他层散落 SQL

### 4.5 middleware
职责：

- 统一错误处理
- 请求日志
- 通用请求校验

### 4.6 utils
职责：

- 纯工具函数
- 响应封装
- 错误类型定义
- 文件处理辅助函数

---

## 5. 命名规范

### 5.1 文件命名
- 路由：`xxx.routes.js`
- 控制器：`xxx.controller.js`
- 服务：`xxx.service.js`
- 仓储：`xxx.repository.js`

### 5.2 函数命名
函数名必须是“动作 + 对象”。

正确示例：

- `parseImportedDocument`
- `saveWordsToBook`
- `getWordBookDetail`
- `startDictationSession`
- `updateReviewProgress`

不推荐：

- `handleData`
- `runTask`
- `doThing`
- `mainProcess`

### 5.3 变量命名
- 布尔值：`is` / `has` / `can`
- 数组：复数
- Repository 查询结果保持语义清晰

正确示例：

- `candidateWords`
- `existingBook`
- `isDuplicateWord`
- `historyRecords`

---

## 6. 路由与接口设计规范

### 6.1 路由按资源域划分
推荐模式：

- `/api/import/*`
- `/api/library/*`
- `/api/dictation/*`
- `/api/settings/*`
- `/api/history/*`

### 6.2 接口命名应体现业务语义
不要只用模糊的 `/do`、`/process`、`/action`。

### 6.3 输入参数明确
每个接口必须明确：

- 路径参数
- query 参数
- body 参数
- 文件上传参数

### 6.4 输出结构统一
统一返回格式：

```json
{
  "success": true,
  "data": {},
  "error": ""
}
```

对于列表接口，建议：

```json
{
  "success": true,
  "data": {
    "items": [],
    "total": 0
  },
  "error": ""
}
```

---

## 7. Controller 规范

### 7.1 Controller 只做四件事
1. 取参数
2. 基础校验
3. 调 service
4. 返回响应

### 7.2 不在 controller 中写复杂逻辑
例如以下逻辑不应放 controller：

- 文本清洗算法
- 候选词生成规则
- 复习进度计算
- 多表数据聚合逻辑

### 7.3 Controller 必须明确错误出口
发生异常时必须走统一错误处理，不允许每个 controller 各写一套返回风格。

---

## 8. Service 规范

### 8.1 Service 是业务中心
复杂逻辑必须放 service。

例如：

- 文件导入后解析文本
- 从文本中提取候选词
- 根据用户选择保存词条
- 生成听写任务
- 更新复习进度

### 8.2 Service 函数要可复用
每个 service 函数应尽量对应一个明确业务动作，便于 controller 和其他 service 调用。

### 8.3 Service 中允许调用多个 repository
但必须保持顺序清晰、职责明确。

### 8.4 Service 中禁止直接拼 HTTP 响应
service 返回业务数据或抛出业务错误，不负责 `res.writeHead` / `res.end`。

---

## 9. Repository 规范

### 9.1 Repository 只负责数据库
Repository 中禁止：

- 操作 request / response
- 解析文档文件
- 决定业务流程
- 进行 UI 友好文本拼装

### 9.2 SQL 必须集中
所有 SQL 写在 repository 中，不允许散落在 service 或 controller。

### 9.3 返回数据保持克制
Repository 不做过度转换，只做必要字段映射。

---

## 10. 文档解析与文本处理规范

当前项目有文档解析与文本处理需求，因此这两类能力必须单独隔离，不与路由层耦合。

### 10.1 parser.service.js
职责：

- 按文件类型解析文档
- 提取原始文本
- 处理解析失败与降级逻辑

### 10.2 text-processing.service.js
职责：

- 文本清洗
- 分词预处理
- 候选词提取
- 去重与规范化

### 10.3 禁止事项
禁止：

- 在 controller 里直接写复杂解析流程
- 在 repository 中写文本处理规则
- 在 parser 中直接写数据库保存逻辑

---

## 11. 数据库访问规范

### 11.1 统一数据库入口
数据库连接统一从 `db/connection.js` 管理。

### 11.2 迁移与初始化分离
- 表结构初始化：放 migration
- 初始词典或数据填充：放 seed 或 scripts

### 11.3 不在业务代码里隐式建表
禁止 controller 或 service 在运行流程中临时建表。

---

## 12. 错误处理规范

### 12.1 错误分类
建议区分：

- 参数错误
- 业务错误
- 外部依赖错误
- 系统异常

### 12.2 自定义错误对象
建议在 `utils/errors.js` 中定义：

- `AppError`
- `ValidationError`
- `BusinessError`
- `NotFoundError`

### 12.3 统一响应工具
在 `utils/response.js` 中定义：

- `sendSuccess(res, data)`
- `sendError(res, error)`

保证每个接口响应风格统一。

---

## 13. 日志规范

### 13.1 请求日志
至少记录：

- method
- path
- 时间
- 状态码
- 耗时

### 13.2 错误日志
错误必须记录：

- 错误类型
- message
- 关键上下文
- 堆栈（开发环境）

### 13.3 避免日志污染
不要在正常业务路径中过度打印大段对象或全文文本。

---

## 14. AI 生成后端代码时的输出要求

每次让 AI 生成后端代码，必须提供：

### 14.1 任务目标
例如：

- 拆分 import 路由与 service
- 统一接口返回结构
- 重构 dictation 业务逻辑
- 抽离 repository 层

### 14.2 允许修改的文件
必须明确列出文件边界。

### 14.3 禁止修改的范围
例如：

- 不修改数据库 schema
- 不修改其他业务域
- 不引入新框架
- 不调整前端接口字段

### 14.4 输出形式
明确说明：

- 输出完整文件代码
- 或输出 diff
- 或只输出目录结构与职责说明

### 14.5 验收标准
例如：

- 原有接口不退化
- 返回结构统一
- controller 逻辑变薄
- SQL 全部进入 repository
- 错误可统一捕获

---

## 15. 推荐 AI 任务模板

```text
任务目标：
将 Import 模块从单体后端逻辑拆分为 route / controller / service / repository 结构。

上下文：
当前项目为 HearWords，本地运行，Node.js + SQLite。
Import 模块涉及文件导入、文本提取、候选词生成、保存入库。

本次允许修改文件：
- src/routes/import.routes.js
- src/controllers/import.controller.js
- src/services/import.service.js
- src/services/parser.service.js
- src/services/text-processing.service.js
- src/repositories/word.repository.js
- src/utils/response.js

本次禁止修改：
- 数据库表结构
- Dictation 模块
- Settings 模块
- 前端接口字段命名
- 全局配置方式

要求：
1. controller 只做参数接收和响应
2. service 负责业务流程
3. repository 负责 SQL
4. 接口统一返回 success/data/error
5. 输出完整代码，不要只给片段

验收标准：
- 原导入流程可运行
- 代码层次清晰
- 无 SQL 散落在 controller / service
- 错误响应统一
```

---

## 16. 禁止事项

以下行为默认禁止：

- 在单个 `server.js` 中继续堆叠全部逻辑
- 在 controller 中写 SQL
- 在 service 中直接操作 response
- 在 repository 中写业务规则
- 一个任务同时重构多个核心业务域
- 未经说明修改数据库 schema
- 未经说明大规模重命名接口字段
- 未经说明引入重型后端框架
- 把调试代码、console、临时分支长期留在主流程里

---

## 17. 最终要求

后端代码生成的最终目标不是“能跑就行”，而是：

- 路由清晰
- 服务明确
- 数据访问集中
- 错误处理统一
- AI 可以被精准约束在局部任务内工作

如果 AI 产出与本规范冲突，以本规范为准。
