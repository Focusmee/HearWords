const CANDIDATE_PAGE_SIZE = 100;
const LIBRARY_PAGE_SIZE = 50;
const IMPORT_BATCH_SIZE = 200;
const DESK_DRAG_THRESHOLD = 8;
const DESK_LAYOUT_STORAGE_KEY = "hearwordsDeskLayoutV1";

const PANEL_META = {
  service: {
    title: "服务设置",
    subtitle: "把后端连接与增强解析能力收进聚焦层，不干扰桌面主视图。",
  },
  import: {
    title: "导入与清洗",
    subtitle: "上传材料、补全文本、生成候选词条，再确认导入词书。",
  },
  library: {
    title: "词书管理",
    subtitle: "浏览、筛选、编辑词条，并从这里发起新的听写轮次。",
  },
  history: {
    title: "解析记录",
    subtitle: "回看每一次导入来源、解析模式和候选词条结果。",
  },
  dictation: {
    title: "听写训练",
    subtitle: "在最少干扰的信息布局中完成拼写、反馈和重复朗读。",
  },
};

const DESK_NOTE_META = {
  import: {
    eyebrow: "Desk Note",
    title: "导入材料",
    body: "纸质文件夹负责收纳学习材料入口，把上传、OCR 和清洗的说明从物件表面移到右侧便签。",
    detailA: "适合先放入图片、PDF、Word、Excel 与文本",
    detailB: "展开文件夹后可继续进入导入面板",
    cta: "打开导入面板",
    panel: "import",
  },
  library: {
    eyebrow: "Desk Note",
    title: "词书书架",
    body: "书架本体只保留书本和层架的视觉线索，不再直接显示标题文字，由右侧便签说明它的用途。",
    detailA: "点击不同书脊可以快速筛选词书",
    detailB: "点击书架主体可进入词书管理面板",
    cta: "进入词书面板",
    panel: "library",
  },
  history: {
    eyebrow: "Desk Note",
    title: "解析笔记",
    body: "记录本用于查看最近的解析来源、清洗结果和导入轨迹，适合回看材料处理过程。",
    detailA: "展开后能预览最近记录",
    detailB: "点击可打开完整解析记录面板",
    cta: "查看解析记录",
    panel: "history",
  },
  dictation: {
    eyebrow: "Desk Note",
    title: "听写播放器",
    body: "复古随身听是桌面上的听写入口，既能打开训练面板，也能直接控制朗读、重播与跳题。",
    detailA: "点击机身可进入完整听写界面",
    detailB: "底部按键可直接控制当前听写轮次",
    cta: "打开听写面板",
    panel: "dictation",
  },
};

const state = {
  activePanel: "import",
  candidates: [],
  library: [],
  stats: {
    totalWords: 0,
    dueWords: 0,
    todayWords: 0,
  },
  settings: null,
  history: [],
  session: {
    queue: [],
    index: 0,
    scope: "due",
    updatedAt: 0,
  },
  currentWord: null,
  currentSourceNames: [],
  sessionSummary: "",
  playerPaused: false,
  playerVisualState: "idle",
  pagination: {
    candidates: { page: 1, pageSize: CANDIDATE_PAGE_SIZE },
    library: { page: 1, pageSize: LIBRARY_PAGE_SIZE },
  },
};

const els = {
  serviceBadge: document.getElementById("serviceBadge"),
  apiBaseUrl: document.getElementById("apiBaseUrl"),
  apiModel: document.getElementById("apiModel"),
  apiKey: document.getElementById("apiKey"),
  apiTimeout: document.getElementById("apiTimeout"),
  apiSystemPrompt: document.getElementById("apiSystemPrompt"),
  apiEnabled: document.getElementById("apiEnabled"),
  saveSettingsButton: document.getElementById("saveSettingsButton"),
  reloadSettingsButton: document.getElementById("reloadSettingsButton"),
  serviceStatus: document.getElementById("serviceStatus"),
  fileInput: document.getElementById("fileInput"),
  rawText: document.getElementById("rawText"),
  bookNameInput: document.getElementById("bookNameInput"),
  parseButton: document.getElementById("parseButton"),
  seedButton: document.getElementById("seedButton"),
  clearInputButton: document.getElementById("clearInputButton"),
  parseStatus: document.getElementById("parseStatus"),
  modeToggle: document.getElementById("modeToggle"),
  candidateBody: document.getElementById("candidateBody"),
  keepSelectedButton: document.getElementById("keepSelectedButton"),
  discardCandidatesButton: document.getElementById("discardCandidatesButton"),
  candidatePrevButton: document.getElementById("candidatePrevButton"),
  candidateNextButton: document.getElementById("candidateNextButton"),
  candidatePageInfo: document.getElementById("candidatePageInfo"),
  candidateCountInfo: document.getElementById("candidateCountInfo"),
  libraryBody: document.getElementById("libraryBody"),
  searchInput: document.getElementById("searchInput"),
  filterSelect: document.getElementById("filterSelect"),
  sourceFilterSelect: document.getElementById("sourceFilterSelect"),
  libraryPrevButton: document.getElementById("libraryPrevButton"),
  libraryNextButton: document.getElementById("libraryNextButton"),
  libraryPageInfo: document.getElementById("libraryPageInfo"),
  libraryCountInfo: document.getElementById("libraryCountInfo"),
  refreshHistoryButton: document.getElementById("refreshHistoryButton"),
  historyBody: document.getElementById("historyBody"),
  startDueButton: document.getElementById("startDueButton"),
  startAllButton: document.getElementById("startAllButton"),
  exportButton: document.getElementById("exportButton"),
  dictationEmpty: document.getElementById("dictationEmpty"),
  dictationPanel: document.getElementById("dictationPanel"),
  dictationProgress: document.getElementById("dictationProgress"),
  dictationHint: document.getElementById("dictationHint"),
  dictationDefinition: document.getElementById("dictationDefinition"),
  dictationSentence: document.getElementById("dictationSentence"),
  answerInput: document.getElementById("answerInput"),
  checkButton: document.getElementById("checkButton"),
  nextButton: document.getElementById("nextButton"),
  resetSessionButton: document.getElementById("resetSessionButton"),
  speakButton: document.getElementById("speakButton"),
  speakSentenceButton: document.getElementById("speakSentenceButton"),
  feedback: document.getElementById("feedback"),
  totalWords: document.getElementById("totalWords"),
  dueWords: document.getElementById("dueWords"),
  todayWords: document.getElementById("todayWords"),
  focusOverlay: document.getElementById("focusOverlay"),
  closeFocusButton: document.getElementById("closeFocusButton"),
  focusTitle: document.getElementById("focusTitle"),
  focusSubtitle: document.getElementById("focusSubtitle"),
  focusTriggers: Array.from(document.querySelectorAll("[data-panel-target]")),
  focusPanels: Array.from(document.querySelectorAll(".focus-panel")),
  focusTabs: Array.from(document.querySelectorAll(".focus-tab")),
  focusBackdrop: document.querySelector("[data-close-focus='true']"),
  dockCurrentBook: document.getElementById("dockCurrentBook"),
  dockCurrentMode: document.getElementById("dockCurrentMode"),
  dockCurrentProgress: document.getElementById("dockCurrentProgress"),
  dockFooterBook: document.getElementById("dockFooterBook"),
  dockFooterMode: document.getElementById("dockFooterMode"),
  dockFooterProgress: document.getElementById("dockFooterProgress"),
  dockFooterSession: document.getElementById("dockFooterSession"),
  deskLibraryHint: document.getElementById("deskLibraryHint"),
  deskSessionHint: document.getElementById("deskSessionHint"),
  deskInsight: document.getElementById("deskInsight"),
  deskSurface: document.querySelector(".desk-surface"),
  deskLibrary: document.querySelector(".desk-object-library"),
  deskHistory: document.querySelector(".desk-object-history"),
  deskPlayer: document.querySelector(".desk-object-player"),
  deskStatusNote: document.querySelector(".desk-sidecard"),
  deskObjectNoteTitle: document.getElementById("deskObjectNoteTitle"),
  deskObjectNoteText: document.getElementById("deskObjectNoteText"),
  importFolder: document.getElementById("importFolder"),
  importFolderActions: document.getElementById("importFolderActions"),
  deskObjects: Array.from(document.querySelectorAll(".desk-object")),
};

bindEvents();
bootstrap();

function bindEvents() {
  enhanceDeskStatusNote();
  enhanceDeskLibrary();
  enhanceDeskHistory();
  enhanceDeskPlayer();
  enhanceDeskObjectNames();
  els.saveSettingsButton.addEventListener("click", saveSettings);
  els.reloadSettingsButton.addEventListener("click", loadSettings);
  els.refreshHistoryButton.addEventListener("click", loadHistory);
  els.fileInput.addEventListener("change", handleFiles);
  els.parseButton.addEventListener("click", parseInputToCandidates);
  els.seedButton.addEventListener("click", seedDemoText);
  els.clearInputButton.addEventListener("click", clearInputArea);
  els.keepSelectedButton.addEventListener("click", importSelectedCandidates);
  els.discardCandidatesButton.addEventListener("click", clearCandidates);
  els.candidatePrevButton.addEventListener("click", () => changePage("candidates", -1));
  els.candidateNextButton.addEventListener("click", () => changePage("candidates", 1));
  els.libraryPrevButton.addEventListener("click", () => changePage("library", -1));
  els.libraryNextButton.addEventListener("click", () => changePage("library", 1));
  els.searchInput.addEventListener("input", () => {
    resetPage("library");
    renderLibrary();
  });
  els.filterSelect.addEventListener("change", () => {
    resetPage("library");
    renderLibrary();
  });
  els.sourceFilterSelect.addEventListener("change", () => {
    resetPage("library");
    renderLibrary();
  });
  els.startDueButton.addEventListener("click", () => startDictation("due"));
  els.startAllButton.addEventListener("click", () => startDictation("all"));
  els.exportButton.addEventListener("click", exportLibrary);
  els.checkButton.addEventListener("click", checkAnswer);
  els.nextButton.addEventListener("click", skipWord);
  els.resetSessionButton.addEventListener("click", resetSession);
  els.speakButton.addEventListener("click", () => speakCurrent("word"));
  els.speakSentenceButton.addEventListener("click", () => speakCurrent("sentence"));
  els.answerInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      checkAnswer();
    }
  });

  els.focusTriggers.forEach((trigger) => {
    if (trigger === els.importFolder) {
      return;
    }
    if (trigger === els.deskLibrary) {
      return;
    }
    if (trigger === els.deskHistory) {
      return;
    }
    if (trigger === els.deskPlayer) {
      return;
    }
    trigger.addEventListener("click", () => openFocusPanel(trigger.dataset.panelTarget || "import"));
  });

  els.focusTabs.forEach((tab) => {
    tab.addEventListener("click", () => openFocusPanel(tab.dataset.panelTarget || "import"));
  });

  if (els.importFolder) {
    els.importFolder.addEventListener("click", handleImportFolderClick);
  }

  if (els.deskLibrary) {
    els.deskLibrary.addEventListener("click", handleDeskLibraryClick);
  }

  if (els.deskHistory) {
    els.deskHistory.addEventListener("click", handleDeskHistoryClick);
  }

  if (els.deskPlayer) {
    els.deskPlayer.addEventListener("click", handleDeskPlayerClick);
  }

  setupDeskNoteInteractions();

  els.closeFocusButton.addEventListener("click", closeFocusPanel);
  els.focusBackdrop.addEventListener("click", closeFocusPanel);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && els.focusOverlay.classList.contains("open")) {
      closeFocusPanel();
    }
  });

  setupDeskInteractions();
  setupDeskObjectNotes();
}

async function bootstrap() {
  applyPanelState();
  try {
    await Promise.all([checkHealth(), loadSettings(), loadLibrary(), loadSession(), loadHistory()]);
    setServiceStatus("本地服务已连接。", "success");
  } catch (error) {
    els.serviceBadge.textContent = "离线";
    setServiceStatus(`无法连接后端：${error.message}`, "danger");
  }
  syncDeskSignals();
}

async function checkHealth() {
  const payload = await api("/api/health");
  updateStats(payload.stats);
  els.serviceBadge.textContent = payload.dictionaryReady ? "服务在线" : "待导词典";
}

async function loadSettings() {
  const payload = await api("/api/settings");
  state.settings = payload;
  els.apiBaseUrl.value = payload.oneApi.baseUrl || "";
  els.apiModel.value = payload.oneApi.model || "";
  els.apiKey.value = "";
  els.apiTimeout.value = payload.oneApi.timeoutMs || 10000;
  els.apiSystemPrompt.value = payload.oneApi.systemPrompt || "";
  els.apiEnabled.checked = Boolean(payload.oneApi.enabled);
  setServiceStatus(
    payload.hasApiKey
      ? "服务配置已加载，API Key 已保存在服务端。"
      : "服务配置已加载，当前还没有保存 API Key。",
    "muted",
  );
  syncDeskSignals();
}

async function saveSettings() {
  const payload = await api("/api/settings", {
    method: "POST",
    body: {
      oneApi: {
        baseUrl: els.apiBaseUrl.value.trim(),
        model: els.apiModel.value.trim(),
        apiKey: els.apiKey.value.trim(),
        timeoutMs: Number(els.apiTimeout.value) || 10000,
        enabled: els.apiEnabled.checked,
        systemPrompt: els.apiSystemPrompt.value.trim(),
      },
    },
  });
  state.settings = payload.settings;
  els.apiKey.value = "";
  setServiceStatus(payload.message, "success");
  syncDeskSignals();
}

function clearInputArea() {
  els.rawText.value = "";
  els.fileInput.value = "";
  state.currentSourceNames = [];
  setParseStatus("输入区已清空。", "muted");
  syncDeskSignals();
}

function clearCandidates() {
  state.candidates = [];
  resetPage("candidates");
  renderCandidates();
  setParseStatus("候选词条已清空。", "muted");
}

async function handleFiles(event) {
  const files = Array.from(event.target.files || []);
  if (!files.length) {
    return;
  }

  try {
    openFocusPanel("import");
    setParseStatus("正在读取文件内容...", "muted");
    const chunks = [];
    const sourceNames = [];
    const warnings = [];

    for (const file of files) {
      sourceNames.push(file.name);
      const extension = getExtension(file.name);

      try {
        if (file.type.startsWith("image/")) {
          setParseStatus(`正在识别图片：${file.name}`, "muted");
          chunks.push(await ocrImageFile(file));
          continue;
        }

        if (["txt", "md", "csv", "json"].includes(extension)) {
          chunks.push(`\n\n# Source: ${file.name}\n${await file.text()}`);
          continue;
        }

        if (["pdf", "docx", "xlsx"].includes(extension)) {
          setParseStatus(`正在提取文档：${file.name}`, "muted");
          const extracted = await extractDocumentFile(file);
          chunks.push(`\n\n# Source: ${file.name}\n${extracted.text || ""}`);
          continue;
        }

        warnings.push(`${file.name} 格式暂不支持，已跳过。`);
      } catch (error) {
        warnings.push(`${file.name} 处理失败：${error.message}`);
      }
    }

    state.currentSourceNames = sourceNames;
    els.rawText.value = [els.rawText.value.trim(), chunks.join("\n")].filter(Boolean).join("\n\n");

    if (!chunks.length) {
      setParseStatus(warnings[0] || "没有成功读取任何文件内容。", "danger");
      return;
    }

    const warningText = warnings.length ? ` ${warnings.join(" ")}` : "";
    setParseStatus(`已导入 ${chunks.length} 个文件内容块，可以继续补全文本后开始解析。${warningText}`, warnings.length ? "muted" : "success");
    syncDeskSignals();
  } catch (error) {
    setParseStatus(`文件处理失败：${error.message}`, "danger");
  } finally {
    event.target.value = "";
  }
}

async function parseInputToCandidates() {
  const text = els.rawText.value.trim();
  if (!text) {
    setParseStatus("先导入文件或粘贴英文文本。", "danger");
    return;
  }

  try {
    openFocusPanel("import");
    setParseStatus("后端正在解析文本...", "muted");
    const mode = els.modeToggle.checked ? "enhanced" : "normal";
    const payload = await api("/api/parse", {
      method: "POST",
      body: {
        text,
        mode,
        sourceName: state.currentSourceNames.join(", ") || "manual-input",
        bookName: els.bookNameInput.value.trim() || "未命名词书",
      },
    });

    state.candidates = (payload.candidates || []).map((item) => ({ ...item, kept: true }));
    resetPage("candidates");
    renderCandidates();

    if (!state.candidates.length) {
      setParseStatus("没有解析出可用英文词条，请补充更清晰的文本。", "danger");
      return;
    }

    const modeLabel = payload.llmUsed
      ? "One-API 增强解析"
      : payload.mode === "enhanced"
        ? "增强模式降级解析"
        : "普通解析";
    const warningText = payload.warning ? ` ${payload.warning}` : "";
    setParseStatus(
      `已完成 ${modeLabel}，提取 ${state.candidates.length} 个候选词条。${warningText}`,
      payload.warning ? "muted" : "success",
    );
    syncDeskSignals();
  } catch (error) {
    setParseStatus(`解析失败：${error.message}`, "danger");
  }
}

async function importSelectedCandidates() {
  const selected = state.candidates.filter((entry) => entry.kept);
  if (!selected.length) {
    setParseStatus("至少勾选一个候选词条。", "danger");
    return;
  }

  try {
    const bookName = els.bookNameInput.value.trim() || "未命名词书";
    let totalAdded = 0;
    let totalMerged = 0;
    let latestPayload = null;
    const batches = chunkArray(
      selected.map((entry) => ({ ...entry, bookName })),
      IMPORT_BATCH_SIZE,
    );

    for (let index = 0; index < batches.length; index += 1) {
      setParseStatus(
        `正在导入第 ${index + 1} / ${batches.length} 批，共 ${selected.length} 个词条...`,
        "muted",
      );
      latestPayload = await api("/api/library/import", {
        method: "POST",
        body: { entries: batches[index] },
      });
      totalAdded += Number(latestPayload.added || 0);
      totalMerged += Number(latestPayload.merged || 0);
    }

    if (!latestPayload) {
      return;
    }

    applyLibraryPayload(latestPayload, { resetToFirstPage: true });
    setParseStatus(`词书已更新：新增 ${totalAdded} 个，合并 ${totalMerged} 个。`, "success");
    openFocusPanel("library");
  } catch (error) {
    setParseStatus(`导入词书失败：${error.message}`, "danger");
  }
}

async function loadLibrary() {
  const payload = await api("/api/library");
  applyLibraryPayload(payload);
}

async function loadSession() {
  const payload = await api("/api/dictation/session");
  if (payload.current) {
    const shouldContinue = window.confirm("检测到上次未完成的听写进度。确定继续上次进度吗？点击“取消”将重开本轮。");
    if (!shouldContinue) {
      const resetPayload = await api("/api/dictation/session", { method: "DELETE" });
      applySessionPayload(resetPayload, true);
      els.feedback.textContent = "已清空上次进度，可以重新开始听写。";
      return;
    }
  }
  applySessionPayload(payload, true);
}

async function loadHistory() {
  const payload = await api("/api/history");
  state.history = payload.items || [];
  renderHistory();
  syncDeskSignals();
}

async function deleteWord(id) {
  try {
    const payload = await api(`/api/library/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    applyLibraryPayload(payload, { resetToFirstPage: true });
  } catch (error) {
    els.feedback.textContent = `删除失败：${error.message}`;
  }
}

async function editWord(entry) {
  const definition = window.prompt(`编辑 ${entry.lemma} 的释义`, entry.definition || "");
  if (definition === null) {
    return;
  }

  const exampleSentence = window.prompt(`编辑 ${entry.lemma} 的例句`, entry.exampleSentence || "");
  if (exampleSentence === null) {
    return;
  }

  try {
    const payload = await api(`/api/library/${encodeURIComponent(entry.id)}`, {
      method: "PATCH",
      body: {
        definition,
        exampleSentence,
      },
    });

    applyLibraryPayload(payload);
  } catch (error) {
    els.feedback.textContent = `更新失败：${error.message}`;
  }
}

async function startDictation(scope) {
  try {
    if (state.currentWord) {
      const shouldRestart = window.confirm("当前有未完成的听写轮次。确定重新开始新的轮次吗？");
      if (!shouldRestart) {
        openFocusPanel("dictation");
        return;
      }
    }

    const payload = await api("/api/dictation/start", {
      method: "POST",
      body: { scope },
    });
    applySessionPayload(payload);
    openFocusPanel("dictation");
  } catch (error) {
    els.feedback.textContent = `启动听写失败：${error.message}`;
  }
}

async function resetSession() {
  try {
    const payload = await api("/api/dictation/session", {
      method: "DELETE",
    });
    applySessionPayload(payload);
  } catch (error) {
    els.feedback.textContent = `重置失败：${error.message}`;
  }
}

async function checkAnswer() {
  if (!state.currentWord) {
    return;
  }

  const answer = els.answerInput.value.trim();
  if (!answer) {
    els.feedback.textContent = "先输入你听到的单词。";
    return;
  }

  try {
    const payload = await api("/api/dictation/check", {
      method: "POST",
      body: { answer },
    });

    if (payload.stats) {
      updateStats(payload.stats);
      await loadLibrary();
    }

    applySessionPayload(payload);

    if (!payload.correct) {
      setFeedbackError(`拼写错误：${payload.diff}`);
      return;
    }

    if (payload.finished) {
      els.feedback.textContent = "本轮听写已完成。";
    }
  } catch (error) {
    setFeedbackError(`检查失败：${error.message}`);
  }
}

async function skipWord() {
  if (!state.currentWord) {
    return;
  }

  try {
    const payload = await api("/api/dictation/skip", { method: "POST" });
    if (payload.stats) {
      updateStats(payload.stats);
      await loadLibrary();
    }
    applySessionPayload(payload);
    if (!payload.finished) {
      els.feedback.textContent = payload.message || "已跳过当前单词。";
    }
  } catch (error) {
    setFeedbackError(`跳过失败：${error.message}`);
  }
}

function applySessionPayload(payload, silent = false) {
  state.session = payload.session || {
    queue: [],
    index: 0,
    scope: "due",
    updatedAt: 0,
  };
  state.currentWord = payload.current || null;
  state.playerPaused = false;
  state.playerVisualState = payload.current ? "play" : "idle";
  state.sessionSummary = payload.finished ? payload.message || "当前没有进行中的听写轮次。" : "";
  renderDictation();
  if (!silent && state.currentWord) {
    speakCurrent("word");
  }
  syncDeskSignals();
}

function renderCandidates() {
  els.candidateBody.innerHTML = "";
  const template = document.getElementById("candidateRowTemplate");
  const { pageItems, totalPages, totalItems, start, end } = paginate(state.candidates, state.pagination.candidates);

  if (!state.candidates.length) {
    els.candidateBody.innerHTML = `<tr><td colspan="4" class="muted">暂无候选词条。</td></tr>`;
    updatePaginationUi("candidates", 0, 0, 0, 0);
    return;
  }

  pageItems.forEach((entry) => {
    const fragment = template.content.cloneNode(true);
    const checkbox = fragment.querySelector(".candidate-check");
    checkbox.checked = entry.kept;
    checkbox.addEventListener("change", () => {
      entry.kept = checkbox.checked;
    });

    fragment.querySelector(".candidate-word").textContent = entry.lemma;
    fragment.querySelector(".candidate-phonetic").textContent =
      entry.rawWord && entry.rawWord !== entry.lemma
        ? `原词形：${entry.rawWord}`
        : entry.phonetic || "词典词条";
    fragment.querySelector(".candidate-tags").innerHTML = buildMetaTags([
      entry.pos || "",
      entry.fromGlossary ? "词表模式" : "",
      entry.frequency > 1 ? `出现 ${entry.frequency} 次` : "",
    ]);
    fragment.querySelector(".candidate-definition").textContent = entry.definition || "待补充释义";
    fragment.querySelector(".candidate-example").textContent = entry.exampleSentence || "词典暂无例句";
    fragment.querySelector(".candidate-meta").textContent = `${entry.bookName || "未命名词书"} · ${entry.sourceName}`;

    els.candidateBody.appendChild(fragment);
  });

  updatePaginationUi("candidates", totalItems, totalPages, start, end);
}

function renderLibrary() {
  els.libraryBody.innerHTML = "";
  const template = document.getElementById("libraryRowTemplate");
  const filtered = getFilteredLibraryItems();
  const { pageItems, totalPages, totalItems, start, end } = paginate(filtered, state.pagination.library);

  if (!filtered.length) {
    els.libraryBody.innerHTML = `<tr><td colspan="6" class="muted">当前筛选条件下没有词条。</td></tr>`;
    updatePaginationUi("library", 0, 0, 0, 0);
    syncDeskSignals();
    return;
  }

  pageItems.forEach((entry) => {
    const fragment = template.content.cloneNode(true);
    fragment.querySelector(".library-word").textContent = entry.lemma;
    fragment.querySelector(".library-tags").innerHTML = buildMetaTags([
      entry.pos || "",
      entry.bookName || "未命名词书",
      entry.sourceName || "manual-input",
    ]);
    fragment.querySelector(".library-original").textContent = `原词形：${(entry.originalForms || [entry.rawWord]).filter(Boolean).join(", ")}`;
    fragment.querySelector(".library-definition").textContent = entry.definition || "待补充释义";
    fragment.querySelector(".library-example").textContent = entry.exampleSentence || "词典暂无例句";
    fragment.querySelector(".library-mastery").textContent = `${entry.masteryLevel} / 5`;
    fragment.querySelector(".library-review").textContent = formatReviewTime(entry.nextReviewTime);

    const actions = fragment.querySelector(".actions");
    actions.appendChild(actionButton("朗读", () => speakText(entry.lemma)));
    actions.appendChild(actionButton("例句", () => speakText(entry.exampleSentence || entry.lemma)));
    actions.appendChild(actionButton("编辑", () => editWord(entry)));
    actions.appendChild(actionButton("删除", () => deleteWord(entry.id)));

    els.libraryBody.appendChild(fragment);
  });

  updatePaginationUi("library", totalItems, totalPages, start, end);
  syncDeskSignals();
}

function getFilteredLibraryItems() {
  const query = els.searchInput.value.trim().toLowerCase();
  const filter = els.filterSelect.value;
  const sourceFilter = els.sourceFilterSelect.value;
  const now = Date.now();

  return state.library.filter((entry) => {
    const matchesQuery =
      !query ||
      entry.lemma.toLowerCase().includes(query) ||
      (entry.definition || "").toLowerCase().includes(query) ||
      (entry.exampleSentence || "").toLowerCase().includes(query);

    if (!matchesQuery) {
      return false;
    }

    if (sourceFilter !== "all") {
      const composite = `${entry.bookName || "未命名词书"}|${entry.sourceName || "manual-input"}`;
      if (composite !== sourceFilter) {
        return false;
      }
    }

    if (filter === "due") {
      return entry.nextReviewTime <= now;
    }
    if (filter === "new") {
      return entry.masteryLevel === 0;
    }
    if (filter === "mastered") {
      return entry.masteryLevel >= 4;
    }
    return true;
  });
}

function renderDictation() {
  if (!state.currentWord) {
    els.dictationEmpty.textContent = state.sessionSummary || "还没有开始听写。先从词书中开启一轮复习。";
    els.dictationEmpty.classList.remove("hidden");
    els.dictationPanel.classList.add("hidden");
    syncDeskSignals();
    return;
  }

  els.dictationEmpty.classList.add("hidden");
  els.dictationPanel.classList.remove("hidden");
  els.dictationProgress.textContent = `${state.session.index + 1} / ${state.session.queue.length}`;
  els.dictationHint.textContent = state.session.scope === "all" ? "全部轮次" : "待复习";
  els.dictationDefinition.textContent = state.currentWord.definition;
  els.dictationSentence.textContent = state.currentWord.exampleSentence || "暂无例句，可直接播放单词。";
  els.answerInput.value = "";
  els.feedback.textContent = "点击播放后开始听写。";
  syncDeskSignals();
}

function renderHistory() {
  els.historyBody.innerHTML = "";
  const template = document.getElementById("historyRowTemplate");

  if (!state.history.length) {
    els.historyBody.innerHTML = `<tr><td colspan="5" class="muted">暂无解析历史。</td></tr>`;
    return;
  }

  state.history.forEach((item) => {
    const fragment = template.content.cloneNode(true);
    fragment.querySelector(".history-time").textContent = formatDateTime(item.createdAt);
    fragment.querySelector(".history-book").textContent = item.bookName || "未命名词书";
    fragment.querySelector(".history-source").textContent = item.sourceName || "manual-input";
    fragment.querySelector(".history-mode").textContent = item.llmUsed
      ? "One-API"
      : item.mode === "enhanced"
        ? "增强降级"
        : "普通";
    fragment.querySelector(".history-result").textContent =
      `${item.candidateCount || 0} 个候选${item.warning ? `\n${item.warning}` : ""}`;
    els.historyBody.appendChild(fragment);
  });
}

function speakCurrent(type) {
  if (!state.currentWord) {
    return;
  }

  speakText(type === "sentence" ? state.currentWord.exampleSentence || state.currentWord.lemma : state.currentWord.lemma);
}

function speakText(text) {
  if (!text || !("speechSynthesis" in window)) {
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = 0.92;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function exportLibrary() {
  const blob = new Blob([JSON.stringify(state.library, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "hearwords-library.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

function updateStats(stats) {
  state.stats = stats || state.stats;
  els.totalWords.textContent = String(state.stats.totalWords || 0);
  els.dueWords.textContent = String(state.stats.dueWords || 0);
  els.todayWords.textContent = String(state.stats.todayWords || 0);
  syncDeskSignals();
}

function applyLibraryPayload(payload, options = {}) {
  state.library = Array.isArray(payload.items)
    ? payload.items
    : payload.item
      ? state.library.map((entry) => (entry.id === payload.item.id ? payload.item : entry))
      : state.library;

  updateStats(payload.stats);
  populateSourceFilter(payload.sources || buildSourceOptionsFromLibrary(state.library));

  if (options.resetToFirstPage) {
    resetPage("library");
  }

  renderLibrary();
}

function populateSourceFilter(options) {
  const current = els.sourceFilterSelect.value || "all";
  els.sourceFilterSelect.innerHTML = `<option value="all">全部词书 / 来源</option>`;

  options.forEach((option) => {
    const node = document.createElement("option");
    node.value = option.key;
    node.textContent = `${option.bookName} / ${option.sourceName}`;
    els.sourceFilterSelect.appendChild(node);
  });

  if ([...els.sourceFilterSelect.options].some((option) => option.value === current)) {
    els.sourceFilterSelect.value = current;
  }

  syncDeskShelfState(
    els.sourceFilterSelect.value === "all" ? "all" : "source",
    extractCurrentBookFromFilter() || "全部词书",
  );
}

function buildSourceOptionsFromLibrary(items) {
  const map = new Map();
  (items || []).forEach((entry) => {
    const bookName = entry.bookName || "未命名词书";
    const sourceName = entry.sourceName || "manual-input";
    const key = `${bookName}|${sourceName}`;
    if (!map.has(key)) {
      map.set(key, { key, bookName, sourceName });
    }
  });
  return [...map.values()];
}

function actionButton(text, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "playful-button ghost-button";
  button.textContent = text;
  button.addEventListener("click", handler);
  return button;
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `请求失败 (${response.status})`);
  }
  return payload;
}

async function ocrImageFile(file) {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  const imageBase64 = btoa(binary);
  const payload = await api("/api/ocr", {
    method: "POST",
    body: {
      imageBase64,
      filename: file.name,
    },
  });
  return `\n\n# Source: ${file.name}\n${payload.text || ""}`;
}

async function extractDocumentFile(file) {
  const fileBase64 = await fileToBase64(file);
  const payload = await api("/api/extract-document", {
    method: "POST",
    body: {
      filename: file.name,
      fileBase64,
    },
  });
  return {
    text: payload.text || "",
    documentType: payload.documentType || getExtension(file.name),
    characterCount: Number(payload.characterCount || 0),
  };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const [, base64 = ""] = result.split(",", 2);
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error || new Error("文件读取失败"));
    reader.readAsDataURL(file);
  });
}

function seedDemoText() {
  els.rawText.value = `Learners often capture vocabulary from articles, screenshots, and class notes.
This app can organize unfamiliar words, review them with spaced repetition, and improve spelling through dictation.
When students struggle with pronunciation, they can listen again and associate each word with a sentence.
Good tools transform passive reading into active memory and help users internalize new expressions faster.`;
  openFocusPanel("import");
  setParseStatus("已载入演示文本，可以直接点击解析。", "muted");
}

function formatReviewTime(timestamp) {
  if (!timestamp) {
    return "未安排";
  }

  const delta = timestamp - Date.now();
  if (delta <= 0) {
    return "现在";
  }

  const minutes = Math.round(delta / (60 * 1000));
  if (minutes < 60) {
    return `${minutes} 分钟后`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours} 小时后`;
  }

  return `${Math.round(hours / 24)} 天后`;
}

function formatDateTime(timestamp) {
  if (!timestamp) {
    return "-";
  }

  return new Date(timestamp).toLocaleString("zh-CN", { hour12: false });
}

function setParseStatus(text, type) {
  els.parseStatus.textContent = text;
  els.parseStatus.className = `status-copy ${type}`;
  syncDeskSignals();
}

function setServiceStatus(text, type) {
  els.serviceStatus.textContent = text;
  els.serviceStatus.className = `status-copy ${type}`;
}

function setFeedbackError(text) {
  els.feedback.textContent = text;
}

function getExtension(filename) {
  return filename.split(".").pop().toLowerCase();
}

function buildMetaTags(values) {
  return values
    .filter(Boolean)
    .map((value) => `<span class="meta-tag">${escapeHtml(String(value))}</span>`)
    .join("");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function paginate(items, pager) {
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pager.pageSize));
  pager.page = clamp(pager.page, 1, totalPages);
  const startIndex = (pager.page - 1) * pager.pageSize;
  const endIndex = startIndex + pager.pageSize;
  return {
    pageItems: items.slice(startIndex, endIndex),
    totalItems,
    totalPages,
    start: totalItems ? startIndex + 1 : 0,
    end: Math.min(endIndex, totalItems),
  };
}

function updatePaginationUi(kind, totalItems, totalPages, start, end) {
  if (kind === "candidates") {
    els.candidatePageInfo.textContent = totalItems
      ? `第 ${state.pagination.candidates.page} / ${totalPages} 页`
      : "第 0 / 0 页";
    els.candidateCountInfo.textContent = totalItems ? `显示 ${start}-${end} / ${totalItems}` : "暂无候选词条";
    els.candidatePrevButton.disabled = state.pagination.candidates.page <= 1;
    els.candidateNextButton.disabled = state.pagination.candidates.page >= totalPages;
    return;
  }

  els.libraryPageInfo.textContent = totalItems
    ? `第 ${state.pagination.library.page} / ${totalPages} 页`
    : "第 0 / 0 页";
  els.libraryCountInfo.textContent = totalItems ? `显示 ${start}-${end} / ${totalItems}` : "暂无词条";
  els.libraryPrevButton.disabled = state.pagination.library.page <= 1;
  els.libraryNextButton.disabled = state.pagination.library.page >= totalPages;
}

function changePage(kind, delta) {
  state.pagination[kind].page = Math.max(1, state.pagination[kind].page + delta);
  if (kind === "candidates") {
    renderCandidates();
    return;
  }
  renderLibrary();
}

function resetPage(kind) {
  state.pagination[kind].page = 1;
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function openFocusPanel(panelName) {
  state.activePanel = PANEL_META[panelName] ? panelName : "import";
  applyPanelState();
  els.focusOverlay.classList.add("open");
  els.focusOverlay.setAttribute("aria-hidden", "false");
}

function closeFocusPanel() {
  els.focusOverlay.classList.remove("open");
  els.focusOverlay.setAttribute("aria-hidden", "true");
}

function enhanceDeskStatusNote() {
  if (!els.deskStatusNote) {
    return;
  }

  els.deskStatusNote.dataset.objectName = "桌面便签";
  els.deskStatusNote.dataset.noteTarget = "status";
  els.deskStatusNote.setAttribute("aria-label", "桌面状态便签");
}

function setupDeskNoteInteractions() {
  if (!els.deskStatusNote) {
    return;
  }

  els.deskStatusNote.addEventListener("click", () => {
    const fallbackPanel = state.activePanel || "import";
    openFocusPanel(fallbackPanel);
  });

  els.deskStatusNote.addEventListener("pointerenter", () => updateDeskObjectNote(els.deskStatusNote));
  els.deskStatusNote.addEventListener("focus", () => updateDeskObjectNote(els.deskStatusNote));
}

function enhanceDeskHistory() {
  if (!els.deskHistory) {
    return;
  }

  els.deskHistory.classList.add("paper-notebook");
  els.deskHistory.dataset.noteTarget = "history";
  els.deskHistory.setAttribute("aria-label", "桌面解析记录笔记本");
  els.deskHistoryTitle = document.getElementById("deskHistoryTitle");
  els.deskHistoryHint = document.getElementById("deskHistoryHint");
  els.deskHistoryCount = document.getElementById("deskHistoryCount");
  els.deskHistoryLatest = document.getElementById("deskHistoryLatest");
  els.deskHistoryPreview = document.getElementById("deskHistoryPreview");
}

function enhanceDeskLibrary() {
  if (!els.deskLibrary) {
    return;
  }

  els.deskLibrary.classList.add("bookshelf-object");
  els.deskLibrary.dataset.noteTarget = "library";
  els.deskLibrary.setAttribute("aria-label", "桌面词书书架");
  els.deskLibraryHint = document.getElementById("deskLibraryHint");
  els.deskShelfTitle = document.getElementById("deskShelfTitle");
  els.deskShelfMeta = document.getElementById("deskShelfMeta");
}

function enhanceDeskPlayer() {
  if (!els.deskPlayer) {
    return;
  }

  els.deskPlayer.classList.add("retro-player");
  els.deskPlayer.dataset.noteTarget = "dictation";
  els.deskPlayer.setAttribute("aria-label", "桌面听写播放器");
  els.deskSessionHint = document.getElementById("deskSessionHint");
  els.deskPlayerTitle = document.getElementById("deskPlayerTitle");
  els.deskPlayerMeta = document.getElementById("deskPlayerMeta");
}

function enhanceDeskObjectNames() {
  setDeskObjectName(els.importFolder, "导入文件夹");
  setDeskObjectName(els.deskLibrary, "词书书架");
  setDeskObjectName(els.deskHistory, "解析笔记本");
  setDeskObjectName(els.deskPlayer, "听写播放器");
  setDeskObjectName(els.deskStatusNote, "桌面便签");
}

function setDeskObjectName(target, name) {
  if (!target) {
    return;
  }

  target.dataset.objectName = name;
  let nameplate = target.querySelector(".desk-object-nameplate");
  if (!nameplate) {
    nameplate = document.createElement("span");
    nameplate.className = "desk-object-nameplate";
    nameplate.setAttribute("aria-hidden", "true");
    target.append(nameplate);
  }
  nameplate.textContent = name;
}

function handleImportFolderClick(event) {
  if (consumeDeskDragClick(event.currentTarget)) {
    return;
  }

  const clickedAction = event.target.closest(".folder-action-open");
  if (clickedAction) {
    openFocusPanel("import");
    return;
  }

  toggleImportFolder();
}

async function handleDeskPlayerClick(event) {
  if (consumeDeskDragClick(event.currentTarget)) {
    return;
  }

  const control = event.target.closest("[data-player-control]");
  if (!control) {
    openFocusPanel("dictation");
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const action = control.dataset.playerControl;
  if (action === "play") {
    state.playerPaused = false;
    state.playerVisualState = "play";
    if (!state.currentWord) {
      await startDictation("due");
      return;
    }
    speakCurrent("word");
    syncDeskSignals();
    return;
  }

  if (action === "pause") {
    state.playerPaused = true;
    state.playerVisualState = "pause";
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    els.feedback.textContent = "已暂停当前朗读。";
    syncDeskSignals("朗读已暂停");
    return;
  }

  if (action === "replay") {
    state.playerPaused = false;
    state.playerVisualState = "replay";
    if (!state.currentWord) {
      openFocusPanel("dictation");
      return;
    }
    speakCurrent("word");
    return;
  }

  if (action === "skip") {
    state.playerVisualState = "skip";
    if (!state.currentWord) {
      openFocusPanel("dictation");
      return;
    }
    await skipWord();
  }
}

function handleDeskLibraryClick(event) {
  if (consumeDeskDragClick(event.currentTarget)) {
    return;
  }

  const book = event.target.closest("[data-shelf-filter]");
  if (!book) {
    openFocusPanel("library");
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const filterKey = String(book.dataset.shelfFilter || "all").toLowerCase();
  applyDeskShelfFilter(filterKey);
  openFocusPanel("library");
}

function applyDeskShelfFilter(filterKey) {
  let matchedValue = "all";
  let matchedLabel = "全部词书";

  if (filterKey === "recent") {
    els.filterSelect.value = "new";
    matchedLabel = "最近新增";
  } else {
    els.filterSelect.value = "all";
    if (filterKey !== "all") {
      const matchedOption = [...els.sourceFilterSelect.options].find(
        (option) => option.value !== "all" && option.textContent.toLowerCase().includes(filterKey),
      );
      if (matchedOption) {
        matchedValue = matchedOption.value;
        matchedLabel = matchedOption.textContent.split(" / ")[0];
      }
    }
  }

  els.sourceFilterSelect.value = matchedValue;
  resetPage("library");
  renderLibrary();
  syncDeskShelfState(filterKey, matchedLabel);
}

function handleDeskHistoryClick(event) {
  if (consumeDeskDragClick(event.currentTarget)) {
    return;
  }

  const clickedAction = event.target.closest(".notebook-open");
  if (clickedAction) {
    openFocusPanel("history");
    return;
  }

  toggleDeskHistory();
}

function toggleImportFolder(forceOpen) {
  if (!els.importFolder) {
    return;
  }

  const shouldOpen = typeof forceOpen === "boolean"
    ? forceOpen
    : !els.importFolder.classList.contains("is-open");

  els.importFolder.classList.toggle("is-open", shouldOpen);
  els.importFolder.setAttribute("aria-expanded", String(shouldOpen));
  if (els.importFolderActions) {
    els.importFolderActions.setAttribute("aria-hidden", String(!shouldOpen));
  }
}

function toggleDeskHistory(forceOpen) {
  if (!els.deskHistory) {
    return;
  }

  const shouldOpen = typeof forceOpen === "boolean"
    ? forceOpen
    : !els.deskHistory.classList.contains("is-open");

  els.deskHistory.classList.toggle("is-open", shouldOpen);
  if (els.deskHistoryPreview) {
    els.deskHistoryPreview.setAttribute("aria-hidden", String(!shouldOpen));
  }
}

function setupDeskObjectNotes() {
  els.deskObjects.forEach((object) => {
    object.addEventListener("pointerenter", () => updateDeskObjectNote(object));
    object.addEventListener("focus", () => updateDeskObjectNote(object));
  });

  if (els.deskSurface) {
    els.deskSurface.addEventListener("pointerleave", () => updateDeskObjectNote());
  }
}

function updateDeskObjectNote(targetObject) {
  if (!els.deskObjectNoteTitle || !els.deskObjectNoteText) {
    return;
  }

  const fallbackObject = getDeskObjectByPanel(state.activePanel);
  const object = targetObject || fallbackObject;
  const note = getDeskObjectNoteMeta(object);

  els.deskObjectNoteTitle.textContent = note.title;
  els.deskObjectNoteText.textContent = note.text;
}

function getDeskObjectByPanel(panelName) {
  if (panelName === "library") {
    return els.deskLibrary;
  }
  if (panelName === "history") {
    return els.deskHistory;
  }
  if (panelName === "dictation") {
    return els.deskPlayer;
  }
  if (panelName === "import") {
    return els.importFolder;
  }
  return null;
}

function getDeskObjectNoteMeta(object) {
  if (object === els.deskStatusNote) {
    return {
      title: "桌面便签",
      text: "这张便签负责解释你当前悬停的桌面物件是什么，以及点开后会进入哪一块功能。",
    };
  }
  if (object === els.deskLibrary) {
    return {
      title: "词书书架",
      text: "这里是你的词书入口。点击不同书本可以切换词书分类，进入词书面板后再筛选、复习和导出。",
    };
  }
  if (object === els.deskHistory) {
    return {
      title: "解析记录笔记本",
      text: "这里保存每次导入和解析的学习痕迹。点开可以回看来源、模式和候选结果。",
    };
  }
  if (object === els.deskPlayer) {
    return {
      title: "听写播放器",
      text: "这是桌面听写设备。点机身进入听写面板，点按键可以开始、暂停、重播或跳过当前单词。",
    };
  }
  if (object === els.importFolder) {
    return {
      title: "导入文件夹",
      text: "这里负责导入图片、PDF、Word 和文本材料。先展开文件夹，再进入导入面板处理内容。",
    };
  }
  return {
    title: "桌面物件说明",
    text: "把鼠标移到右侧物件上，这里会告诉你它是什么以及可以做什么。",
  };
}

function applyPanelState() {
  const panel = PANEL_META[state.activePanel] || PANEL_META.import;
  els.focusTitle.textContent = panel.title;
  els.focusSubtitle.textContent = panel.subtitle;

  els.focusPanels.forEach((section) => {
    section.classList.toggle("active", section.dataset.panel === state.activePanel);
  });

  els.focusTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.panelTarget === state.activePanel);
  });

  els.deskObjects.forEach((object) => {
    object.classList.toggle("active", object.dataset.panelTarget === state.activePanel);
  });
  updateDeskObjectNote();
}

function syncDeskSignals(playerOverride) {
  const selectedBook =
    els.bookNameInput.value.trim() ||
    extractCurrentBookFromFilter() ||
    (state.currentWord && state.currentWord.bookName) ||
    "未选择";
  const modeLabel = els.modeToggle.checked ? "增强模式" : "普通模式";
  const progressLabel = state.currentWord
    ? `${state.session.index + 1} / ${state.session.queue.length}`
    : "0 / 0";
  const sessionLabel = state.currentWord
    ? `${state.session.scope === "all" ? "全部训练" : "待复习训练"}进行中`
    : "空闲中";
  const libraryHint = state.library.length ? `已整理 ${state.library.length} 个词条` : "还没有导入词条";
  const sessionHint = state.currentWord
    ? `当前第 ${state.session.index + 1} / ${state.session.queue.length} 题`
    : "当前未开始训练";

  els.dockCurrentBook.textContent = selectedBook;
  els.dockCurrentMode.textContent = modeLabel;
  els.dockCurrentProgress.textContent = progressLabel;
  els.dockFooterBook.textContent = selectedBook;
  els.dockFooterMode.textContent = modeLabel;
  els.dockFooterProgress.textContent = progressLabel;
  els.dockFooterSession.textContent = sessionLabel;
  els.deskLibraryHint.textContent = libraryHint;
  els.deskSessionHint.textContent = sessionHint;
  if (els.deskPlayerTitle) {
    els.deskPlayerTitle.textContent = state.currentWord ? state.currentWord.lemma : "开始听写";
  }
  if (els.deskPlayerMeta) {
    els.deskPlayerMeta.textContent = playerOverride || (state.currentWord ? "按键可直接控制当前听写" : "点击机身打开面板");
  }
  if (els.deskPlayer) {
    els.deskPlayer.classList.toggle("is-playing", Boolean(state.currentWord) && !state.playerPaused);
    els.deskPlayer.classList.toggle("is-paused", Boolean(state.currentWord) && state.playerPaused);
    els.deskPlayer.dataset.playerState = state.playerVisualState;

    const buttons = els.deskPlayer.querySelectorAll("[data-player-control]");
    buttons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.playerControl === state.playerVisualState);
    });
  }
  if (els.deskHistoryTitle) {
    els.deskHistoryTitle.textContent = state.history.length ? "解析记录" : "学习笔记";
  }
  if (els.deskHistoryHint) {
    els.deskHistoryHint.textContent = state.history.length
      ? `${Math.min(state.history.length, 9)} 条最近记录可查看`
      : "回看来源与清洗结果";
  }
  if (els.deskHistoryCount) {
    els.deskHistoryCount.textContent = `${state.history.length} 条记录`;
  }
  if (els.deskHistoryLatest) {
    const latestHistory = state.history[0];
    els.deskHistoryLatest.textContent = latestHistory
      ? (latestHistory.bookName || latestHistory.sourceName || "最近一次导入")
      : "暂无最近导入";
  }
  els.deskInsight.textContent = state.currentWord
    ? `正在训练 ${state.currentWord.lemma}，可继续朗读、拼写与跳题。`
    : state.sessionSummary || "还没有进行中的听写轮次。";
  syncDeskShelfState(
    els.sourceFilterSelect.value === "all" ? "all" : "source",
    extractCurrentBookFromFilter() || "全部词书",
  );
}

function syncDeskShelfState(activeKey, label) {
  if (!els.deskLibrary) {
    return;
  }

  const normalized = String(activeKey || "all").toLowerCase();
  const books = els.deskLibrary.querySelectorAll("[data-shelf-filter]");
  books.forEach((book) => {
    const bookKey = String(book.dataset.shelfFilter || "").toLowerCase();
    const shouldHighlight = normalized === "all"
      ? bookKey === "all"
      : normalized === "source"
        ? false
        : bookKey === normalized;
    book.classList.toggle("active", shouldHighlight);
  });

  if (els.deskShelfTitle) {
    els.deskShelfTitle.textContent = label || "我的词书";
  }
  if (els.deskShelfMeta) {
    els.deskShelfMeta.textContent = state.library.length
      ? `当前共 ${state.library.length} 个词条，点击书本切换分类`
      : "点击书本筛选词书";
  }
}

function extractCurrentBookFromFilter() {
  if (els.sourceFilterSelect.value === "all") {
    return "";
  }
  const selectedOption = els.sourceFilterSelect.selectedOptions[0];
  return selectedOption ? selectedOption.textContent.split(" / ")[0] : "";
}

function setupDeskInteractions() {
  const draggableDeskItems = [...new Set([...els.deskObjects, els.deskStatusNote].filter(Boolean))];

  if (!els.deskSurface || window.innerWidth <= 1080) {
    return;
  }

  let dragOrder = 20;
  initializeDeskObjectPositions(draggableDeskItems);
  window.addEventListener("resize", () => {
    if (window.innerWidth <= 1080 || !els.deskSurface) {
      return;
    }
    clampDeskObjectPositions(draggableDeskItems);
    persistDeskObjectPositions(draggableDeskItems);
  });

  draggableDeskItems.forEach((object) => {
    let pointerId = null;
    let startX = 0;
    let startY = 0;
    let originLeft = 0;
    let originTop = 0;
    let moved = false;

    const onPointerMove = (event) => {
      if (event.pointerId !== pointerId) {
        return;
      }

      const deltaX = event.clientX - startX;
      const deltaY = event.clientY - startY;
      if (!moved && Math.hypot(deltaX, deltaY) < DESK_DRAG_THRESHOLD) {
        return;
      }

      moved = true;
      object.classList.add("is-dragging");

      const surfaceRect = els.deskSurface.getBoundingClientRect();
      const nextLeft = clamp(originLeft + deltaX, 12, surfaceRect.width - object.offsetWidth - 12);
      const nextTop = clamp(originTop + deltaY, 12, surfaceRect.height - object.offsetHeight - 12);
      const tilt = clamp(deltaX * 0.035, -4, 4);

      object.style.left = `${nextLeft}px`;
      object.style.top = `${nextTop}px`;
      object.style.right = "auto";
      object.style.bottom = "auto";
      object.style.transform = `rotate(${tilt}deg)`;
    };

    const onPointerUp = (event) => {
      if (event.pointerId !== pointerId) {
        return;
      }

      object.releasePointerCapture?.(pointerId);
      pointerId = null;
      if (moved) {
        object.dataset.dragSuppressClick = "true";
        window.setTimeout(() => {
          delete object.dataset.dragSuppressClick;
        }, 0);
      }
      object.classList.remove("is-dragging");
      object.style.transform = "";
      persistDeskObjectPositions(draggableDeskItems);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };

    object.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || window.innerWidth <= 1080) {
        return;
      }

      pointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      originLeft = parseFloat(object.style.left) || 0;
      originTop = parseFloat(object.style.top) || 0;
      moved = false;
      object.style.zIndex = String(++dragOrder);
      object.setPointerCapture?.(pointerId);
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    });

    object.addEventListener("click", (event) => {
      if (!object.dataset.dragSuppressClick) {
        return;
      }
      delete object.dataset.dragSuppressClick;
      event.preventDefault();
      event.stopPropagation();
    }, true);
  });
}

function initializeDeskObjectPositions(objects) {
  const surfaceRect = els.deskSurface.getBoundingClientRect();
  const storedLayout = readDeskLayout();

  objects.forEach((object) => {
    const rect = object.getBoundingClientRect();
    const layoutKey = getDeskLayoutKey(object);
    const savedPosition = storedLayout[layoutKey];
    const defaultLeft = rect.left - surfaceRect.left;
    const defaultTop = rect.top - surfaceRect.top;
    const nextLeft = clampDeskPosition(
      typeof savedPosition?.left === "number" ? savedPosition.left : defaultLeft,
      surfaceRect.width,
      object.offsetWidth,
    );
    const nextTop = clampDeskPosition(
      typeof savedPosition?.top === "number" ? savedPosition.top : defaultTop,
      surfaceRect.height,
      object.offsetHeight,
    );
    object.style.left = `${nextLeft}px`;
    object.style.top = `${nextTop}px`;
    object.style.right = "auto";
    object.style.bottom = "auto";
  });
}

function clampDeskObjectPositions(objects) {
  const surfaceRect = els.deskSurface.getBoundingClientRect();

  objects.forEach((object) => {
    const currentLeft = parseFloat(object.style.left) || 0;
    const currentTop = parseFloat(object.style.top) || 0;
    object.style.left = `${clampDeskPosition(currentLeft, surfaceRect.width, object.offsetWidth)}px`;
    object.style.top = `${clampDeskPosition(currentTop, surfaceRect.height, object.offsetHeight)}px`;
    object.style.right = "auto";
    object.style.bottom = "auto";
  });
}

function clampDeskPosition(value, surfaceSize, objectSize) {
  return clamp(value, 12, Math.max(12, surfaceSize - objectSize - 12));
}

function persistDeskObjectPositions(objects) {
  const layout = {};

  objects.forEach((object) => {
    layout[getDeskLayoutKey(object)] = {
      left: parseFloat(object.style.left) || 0,
      top: parseFloat(object.style.top) || 0,
    };
  });

  try {
    window.localStorage.setItem(DESK_LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch (error) {
    console.warn("Failed to persist desk layout", error);
  }
}

function readDeskLayout() {
  try {
    return JSON.parse(window.localStorage.getItem(DESK_LAYOUT_STORAGE_KEY) || "{}");
  } catch (error) {
    console.warn("Failed to read desk layout", error);
    return {};
  }
}

function getDeskLayoutKey(object) {
  return object.id
    || object.dataset.panelTarget
    || object.dataset.noteTarget
    || object.dataset.objectName
    || "desk-object";
}

function consumeDeskDragClick(target) {
  if (!target || !target.dataset.dragSuppressClick) {
    return false;
  }

  delete target.dataset.dragSuppressClick;
  return true;
}
