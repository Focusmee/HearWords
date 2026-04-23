# HearWords 前端代码生成规范（Vue 版）

## 1. 目标

本规范用于约束 AI 参与 HearWords 前端代码生成时的输出方式，确保代码具有以下特征：

- 模块边界清晰
- 组件职责单一
- 状态与视图分离
- 接口调用集中管理
- 可逐步迭代，不因局部改动破坏整体结构

本规范适用于：

- Vue 3
- Vite
- Pinia
- Vue Router
- 原则上使用原生 CSS 或项目内部样式体系，不默认引入重型 UI 框架

---

## 2. 总体原则

### 2.1 单次任务只允许处理一个模块
一次任务只能聚焦一个业务模块，例如：

- Import
- Library
- Dictation
- Settings
- History

禁止一个任务同时修改多个核心模块，除非任务目标明确是“公共层重构”。

### 2.2 优先结构，后功能，最后样式
AI 输出顺序必须遵循：

1. 先建立目录和边界
2. 再补业务逻辑
3. 再接接口
4. 最后调整视觉样式

禁止先做复杂 UI，再回头补结构。

### 2.3 页面层不承载过多业务细节
页面组件只负责：

- 组织布局
- 调度子组件
- 调用 store / service

页面中不应堆积大量业务细节判断。

### 2.4 子组件不得直接承担系统级职责
子组件只负责：

- 展示
- 局部交互
- 通过 props / emits 通信

子组件默认不得：

- 直接发起接口请求
- 直接维护全局状态
- 直接依赖路由逻辑
- 直接操作浏览器全局对象，除非为明确封装目的

### 2.5 所有接口调用必须集中在 services 层
任何 `fetch`、`axios` 或其他 HTTP 请求，必须统一收敛到 `src/services/`。

禁止在以下位置直接写接口请求：

- views
- 普通 components
- composables（除非该 composable 明确用于封装请求流程）

### 2.6 状态必须集中管理
可复用、跨组件或跨页面的状态，必须进入 Pinia store。

适合放入 store 的内容包括：

- 当前词书
- 候选词列表
- 导入解析结果
- 听写进度
- 设置项
- 全局 loading / error 状态

不适合放入 store 的内容包括：

- 临时 hover 状态
- 单个弹窗的局部输入框值
- 单个子组件的纯展示折叠状态

---

## 3. 推荐目录结构

```text
frontend/
├─ src/
│  ├─ assets/
│  │  ├─ icons/
│  │  ├─ images/
│  │  └─ styles/
│  │     ├─ variables.css
│  │     ├─ reset.css
│  │     └─ theme.css
│  ├─ components/
│  │  ├─ common/
│  │  ├─ desk/
│  │  ├─ import/
│  │  ├─ library/
│  │  ├─ dictation/
│  │  └─ settings/
│  ├─ views/
│  │  ├─ HomeView.vue
│  │  ├─ ImportView.vue
│  │  ├─ LibraryView.vue
│  │  ├─ DictationView.vue
│  │  └─ HistoryView.vue
│  ├─ router/
│  │  └─ index.js
│  ├─ stores/
│  │  ├─ app.store.js
│  │  ├─ import.store.js
│  │  ├─ library.store.js
│  │  ├─ dictation.store.js
│  │  └─ settings.store.js
│  ├─ services/
│  │  ├─ http.js
│  │  ├─ import.service.js
│  │  ├─ library.service.js
│  │  ├─ dictation.service.js
│  │  └─ settings.service.js
│  ├─ composables/
│  │  ├─ useAsync.js
│  │  ├─ useDialog.js
│  │  └─ useDeskFocus.js
│  ├─ utils/
│  │  ├─ format.js
│  │  ├─ validators.js
│  │  └─ constants.js
│  ├─ App.vue
│  └─ main.js
```

---

## 4. 文件职责规范

### 4.1 views
用于页面级入口。

职责：

- 布局组织
- 调用 store
- 调用 service 或协调 composable
- 组合业务组件

禁止：

- 在 view 中堆积重复业务函数
- 在 view 中直接写大量 DOM 操作
- 在 view 中直接写多个模块的逻辑

### 4.2 components/common
用于基础通用组件，例如：

- BaseButton
- BaseInput
- BaseModal
- BasePanel
- EmptyState

要求：

- 命名统一
- API 尽量稳定
- 不耦合具体业务名称

### 4.3 components/import、library、dictation
用于具体业务组件。

要求：

- 一个组件只承担一个主职责
- 父组件负责数据调度
- 子组件通过 props 接收数据，通过 emits 向外通知行为

### 4.4 stores
用于状态集中管理。

要求：

- 每个业务模块一个主 store
- 状态字段命名明确
- action 用动词命名
- getter 用语义化命名

示例：

- `setCandidates`
- `saveImportedWords`
- `startDictation`
- `resetImportState`

### 4.5 services
用于 API 调用与请求封装。

要求：

- 一个业务域一个 service 文件
- 所有请求使用统一 `http.js`
- 必须统一处理成功、失败、异常结构

### 4.6 composables
用于可复用逻辑，不用于堆放杂项函数。

适用场景：

- 异步状态管理
- 弹窗流程控制
- 聚焦层开关
- 通用分页逻辑

禁止把模块主业务全部塞进 composable。

### 4.7 utils
只允许放纯函数和常量，不允许放依赖视图上下文的逻辑。

---

## 5. 命名规范

### 5.1 组件命名
- 组件文件名：PascalCase
- 组件名应体现职责，而不是视觉描述

正确示例：

- `ImportPanel.vue`
- `CandidateList.vue`
- `DictationPlayer.vue`

不推荐：

- `NiceCard.vue`
- `BeautifulBox.vue`
- `MainThing.vue`

### 5.2 store 命名
- 文件名：`xxx.store.js`
- store id 与业务域保持一致

示例：

- `import.store.js`
- `library.store.js`

### 5.3 service 命名
- 文件名：`xxx.service.js`
- 函数名使用动词 + 业务对象

示例：

- `parseImportedFile`
- `fetchWordBooks`
- `saveWordsToBook`
- `submitDictationResult`

### 5.4 变量命名
- 布尔值以 `is`、`has`、`can` 开头
- 数组使用复数名词
- 临时变量名称不得过于模糊

正确示例：

- `isLoading`
- `hasParseError`
- `candidateWords`
- `selectedWordIds`

不推荐：

- `flag`
- `data`
- `list1`
- `tempObj`

---

## 6. 组件设计规范

### 6.1 单一职责
一个组件只解决一个主要问题。

例如 `CandidateList.vue` 负责：

- 展示候选词
- 勾选与取消勾选
- 通知父组件选中变化

它不应该负责：

- 发请求
- 保存数据库
- 管理全局历史状态

### 6.2 父子通信
默认使用：

- props 向下传值
- emits 向上传递事件

只有在明确跨层状态共享时，才使用 store。

### 6.3 禁止隐式副作用
组件 `mounted` 或 `watch` 中，不得在没有明确说明的情况下自动触发复杂流程。

例如：

- 页面一打开就自动发多个请求
- 切换一个 tab 就自动重置全局状态
- watch 一个字段时顺便改动多个无关状态

### 6.4 模板保持清晰
模板层不要写过多复杂表达式。

复杂逻辑应提取为：

- computed
- method
- composable

---

## 7. 状态管理规范（Pinia）

### 7.1 state 只放“状态”，不放推导结果
推导结果优先用 getter / computed。

### 7.2 action 负责业务变化
所有会改变状态的流程应统一通过 action 完成。

### 7.3 store 不直接操纵 DOM
store 只负责状态与业务数据，不负责视图行为。

### 7.4 store 结构建议
每个 store 至少包含：

- `state`
- `getters`
- `actions`

示例：

```js
export const useImportStore = defineStore('import', {
  state: () => ({
    uploadedFile: null,
    rawText: '',
    candidateWords: [],
    selectedWordIds: [],
    isLoading: false,
    errorMessage: ''
  }),
  getters: {
    selectedWords(state) {
      return state.candidateWords.filter(word => state.selectedWordIds.includes(word.id))
    }
  },
  actions: {
    setUploadedFile(file) {},
    setCandidates(words) {},
    toggleWordSelection(wordId) {},
    resetImportState() {}
  }
})
```

---

## 8. API / Service 规范

### 8.1 统一请求入口
所有 HTTP 请求统一通过 `http.js`。

### 8.2 统一返回处理
后端返回结构约定为：

```json
{
  "success": true,
  "data": {},
  "error": ""
}
```

前端 service 层必须统一处理：

- success = true
- success = false
- 网络异常
- 非 2xx 状态码

### 8.3 service 只做请求与数据整形
service 不负责组件 UI，不负责 DOM，不负责页面跳转。

---

## 9. 样式规范

### 9.1 样式优先级
1. 先用全局变量控制主题
2. 组件内使用 scoped 样式
3. 避免在组件中硬编码大量颜色值

### 9.2 设计语言约束
当前项目风格建议：

- warm study
- soft shadow
- low distraction

### 9.3 样式原则
- 少做炫技动画
- 优先信息层级清楚
- 交互状态必须明确
- 避免一个页面过多视觉焦点

---

## 10. 错误处理与用户反馈规范

### 10.1 所有异步操作必须有三态
必须覆盖：

- loading
- success
- error

### 10.2 错误必须对用户可见
错误至少通过以下一种方式显示：

- inline error text
- toast
- alert 区块
- 空状态说明

禁止 silently fail。

### 10.3 禁止吞掉异常
`catch` 后必须：

- 记录错误
- 设置用户可见错误信息
- 结束 loading 状态

---

## 11. AI 生成代码时的输出要求

每次让 AI 生成前端代码，必须包含以下信息：

### 11.1 任务目标
例如：

- 拆分 Import 页面组件
- 接入 Dictation 模块 API
- 重构 Library 的状态管理

### 11.2 允许修改的文件
必须列出明确文件范围。

### 11.3 禁止修改的范围
例如：

- 不修改后端
- 不修改路由
- 不新增依赖
- 不调整其他模块

### 11.4 输出格式要求
明确写：

- 输出完整文件代码
- 还是输出 diff
- 还是只输出目录结构和职责说明

### 11.5 验收标准
例如：

- 页面可运行
- 无控制台报错
- 原功能不退化
- 接口失败时能显示错误信息

---

## 12. 推荐 AI 任务模板

```text
任务目标：
重构 Import 模块为 Vue 组件化结构。

上下文：
当前项目为 HearWords，前端采用 Vue 3 + Vite。
Import 模块包含文件上传、解析预览、候选词展示、确认保存。

本次允许修改文件：
- src/views/ImportView.vue
- src/components/import/FileUploadBox.vue
- src/components/import/ParsePreview.vue
- src/components/import/CandidateList.vue
- src/stores/import.store.js

本次禁止修改：
- 路由
- 其他页面
- 后端接口协议
- 样式主题变量

要求：
1. 父组件负责状态组织
2. 子组件只通过 props / emits 通信
3. 不在子组件中直接发请求
4. 错误状态必须显示
5. 输出完整代码，不要只给片段

验收标准：
- 页面可运行
- 无明显重复逻辑
- 文件职责清晰
- 原有导入流程不退化
```

---

## 13. 禁止事项

以下做法默认禁止：

- 在组件里直接写大量 fetch
- 在多个页面复制相同逻辑
- 用一个超大组件承载整个业务模块
- 一个任务同时重写前端多个核心模块
- 未经说明擅自引入大型依赖
- 未经说明重命名大量字段
- 只改样式却顺手改业务逻辑
- 只改逻辑却顺手改全局主题

---

## 14. 最终要求

前端代码生成的最终目标不是“看起来高级”，而是：

- 可维护
- 可局部迭代
- 易于向 AI 精准下达任务
- 新增功能时不轻易破坏现有结构

如果 AI 输出与本规范冲突，以本规范为准。
