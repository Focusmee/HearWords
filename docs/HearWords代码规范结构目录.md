HearWords/
├─ frontend/                       # Vue 前端
│  ├─ public/
│  │  └─ favicon.ico
│  ├─ src/
│  │  ├─ assets/
│  │  │  ├─ icons/
│  │  │  ├─ images/
│  │  │  └─ styles/
│  │  │     ├─ variables.css
│  │  │     ├─ reset.css
│  │  │     └─ theme.css
│  │  ├─ components/
│  │  │  ├─ common/
│  │  │  │  ├─ BaseButton.vue
│  │  │  │  ├─ BaseInput.vue
│  │  │  │  ├─ BaseModal.vue
│  │  │  │  ├─ BasePanel.vue
│  │  │  │  └─ EmptyState.vue
│  │  │  ├─ desk/
│  │  │  │  ├─ DeskShell.vue
│  │  │  │  ├─ DeskCard.vue
│  │  │  │  └─ FocusOverlay.vue
│  │  │  ├─ import/
│  │  │  │  ├─ ImportPanel.vue
│  │  │  │  ├─ FileUploadBox.vue
│  │  │  │  ├─ ParsePreview.vue
│  │  │  │  └─ CandidateList.vue
│  │  │  ├─ library/
│  │  │  │  ├─ LibraryPanel.vue
│  │  │  │  ├─ WordBookList.vue
│  │  │  │  ├─ WordTable.vue
│  │  │  │  └─ WordEditor.vue
│  │  │  ├─ dictation/
│  │  │  │  ├─ DictationPanel.vue
│  │  │  │  ├─ DictationPlayer.vue
│  │  │  │  ├─ ProgressBar.vue
│  │  │  │  └─ ResultSummary.vue
│  │  │  └─ settings/
│  │  │     └─ SettingsDrawer.vue
│  │  ├─ views/
│  │  │  ├─ HomeView.vue
│  │  │  ├─ ImportView.vue
│  │  │  ├─ LibraryView.vue
│  │  │  ├─ DictationView.vue
│  │  │  └─ HistoryView.vue
│  │  ├─ router/
│  │  │  └─ index.js
│  │  ├─ stores/
│  │  │  ├─ app.store.js
│  │  │  ├─ import.store.js
│  │  │  ├─ library.store.js
│  │  │  ├─ dictation.store.js
│  │  │  └─ settings.store.js
│  │  ├─ services/
│  │  │  ├─ http.js
│  │  │  ├─ import.service.js
│  │  │  ├─ library.service.js
│  │  │  ├─ dictation.service.js
│  │  │  └─ settings.service.js
│  │  ├─ composables/
│  │  │  ├─ useAsync.js
│  │  │  ├─ useDialog.js
│  │  │  ├─ useDeskFocus.js
│  │  │  └─ usePagination.js
│  │  ├─ utils/
│  │  │  ├─ format.js
│  │  │  ├─ validators.js
│  │  │  └─ constants.js
│  │  ├─ App.vue
│  │  └─ main.js
│  ├─ package.json
│  └─ vite.config.js
│
├─ backend/                        # Node 后端
│  ├─ src/
│  │  ├─ app.js                    # 后端应用入口
│  │  ├─ routes/
│  │  │  ├─ import.routes.js
│  │  │  ├─ library.routes.js
│  │  │  ├─ dictation.routes.js
│  │  │  ├─ settings.routes.js
│  │  │  └─ history.routes.js
│  │  ├─ controllers/
│  │  │  ├─ import.controller.js
│  │  │  ├─ library.controller.js
│  │  │  ├─ dictation.controller.js
│  │  │  ├─ settings.controller.js
│  │  │  └─ history.controller.js
│  │  ├─ services/
│  │  │  ├─ import.service.js
│  │  │  ├─ parser.service.js
│  │  │  ├─ text-processing.service.js
│  │  │  ├─ library.service.js
│  │  │  ├─ dictation.service.js
│  │  │  ├─ review.service.js
│  │  │  └─ settings.service.js
│  │  ├─ repositories/
│  │  │  ├─ word.repository.js
│  │  │  ├─ book.repository.js
│  │  │  ├─ history.repository.js
│  │  │  └─ settings.repository.js
│  │  ├─ db/
│  │  │  ├─ connection.js
│  │  │  ├─ migrations/
│  │  │  └─ seed/
│  │  ├─ middleware/
│  │  │  ├─ error-handler.js
│  │  │  ├─ request-logger.js
│  │  │  └─ validate-request.js
│  │  ├─ utils/
│  │  │  ├─ response.js
│  │  │  ├─ errors.js
│  │  │  └─ file.js
│  │  └─ config/
│  │     ├─ env.js
│  │     └─ constants.js
│  ├─ package.json
│  └─ scripts/
│     └─ setup-dictionary.js
│
├─ shared/                         # 前后端共享常量/类型
│  ├─ constants/
│  │  ├─ api.js
│  │  └─ word-status.js
│  └─ schemas/
│     ├─ import.schema.js
│     ├─ word.schema.js
│     └─ dictation.schema.js
│
├─ data/                           # 本地数据
├─ docs/
│  ├─ PRODUCT_SCOPE.md
│  ├─ API_SPEC.md
│  ├─ UI_FLOW.md
│  └─ REFACTOR_PLAN.md
├─ .env.example
├─ .gitignore
└─ README.md