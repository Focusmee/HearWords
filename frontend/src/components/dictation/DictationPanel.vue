<template>
  <SectionCard
    title="听写"
    eyebrow="Dictation"
    description="开始一轮听写 → 查看当前提示 → 输入答案校验 → 跳过 / 重置会话。"
  >
    <template #header-extra>
      <div class="dictation-header">
        <label class="dictation-header__field">
          <span>Mode</span>
          <select v-model="mode" class="dictation-header__select">
            <option value="spelling">spelling</option>
            <option value="listening">listening</option>
          </select>
        </label>
      </div>
    </template>

    <div class="dictation-selection">
      <div class="dictation-selection__title">
        <p class="dictation-selection__heading">出题范围</p>
        <p class="dictation-selection__summary">
          整本加入 {{ includedBookNames.length }} 本，已选单词 {{ selectedWordIds.length }} 个（最终出题集合为两者去重合并）
        </p>
      </div>

      <div class="dictation-selection__grid">
        <div class="dictation-selection__panel">
          <p class="dictation-selection__label">词书（多选）</p>
          <div v-if="books.length" class="dictation-selection__books">
            <label v-for="book in books" :key="book.id" class="dictation-selection__book">
              <input v-model="includedBookNames" type="checkbox" :value="book.name" />
              <span>{{ book.name }}</span>
              <span class="dictation-selection__book-meta">({{ book.wordCount }})</span>
            </label>
          </div>
          <p v-else class="dictation-selection__empty">暂无词书。</p>
        </div>

        <div class="dictation-selection__panel">
          <p class="dictation-selection__label">选词（多选）</p>
          <div class="dictation-selection__search">
            <label class="dictation-selection__field">
              <span>范围</span>
              <select v-model="filterBookName" class="dictation-selection__select">
                <option value="">全库</option>
                <option v-for="book in books" :key="book.id" :value="book.name">{{ book.name }}</option>
              </select>
            </label>
            <label class="dictation-selection__field">
              <span>搜索</span>
              <input
                v-model.trim="wordQuery"
                class="dictation-selection__input"
                placeholder="输入 lemma / rawWord / 释义关键字"
                :disabled="isSearching"
                @keydown.enter.prevent="searchWords"
              />
            </label>
          <button type="button" class="dictation-selection__btn" :disabled="isSearching" @click="searchWords">
            {{ isSearching ? '搜索中…' : '搜索' }}
          </button>
          <button
            type="button"
            class="dictation-selection__btn dictation-selection__btn--ghost"
            :disabled="isSearching"
            @click="clearSelection"
          >
            清空选择
          </button>
          </div>

          <p v-if="searchError" class="dictation-selection__error">{{ searchError }}</p>
          <div v-if="searchResults.length" class="dictation-selection__results">
            <label v-for="entry in searchResults" :key="entry.id" class="dictation-selection__result">
              <input
                type="checkbox"
                :checked="isWordSelected(entry.id)"
                @change="toggleSelectedWord(entry.id)"
              />
              <span class="dictation-selection__result-main">
                <span class="dictation-selection__lemma">{{ entry.lemma }}</span>
                <span class="dictation-selection__hint">{{ entry.definition || '（暂无释义）' }}</span>
              </span>
              <span class="dictation-selection__stats">
                次数 {{ entry.dictationAttempts || 0 }} / 错 {{ entry.failCount || 0 }}
              </span>
            </label>
          </div>
          <p v-else class="dictation-selection__empty">请先搜索，再勾选要加入听写的单词（词书只用于范围筛选，不自动入队）。</p>
        </div>
      </div>
    </div>

    <div class="dictation-grid">
      <div class="dictation-stage">
        <div class="dictation-stage__meta">
          <p class="dictation-stage__label">当前进度</p>
          <p class="dictation-stage__value">
            <span v-if="session.queue.length">
              {{ session.index + 1 }} / {{ session.queue.length }}
            </span>
            <span v-else>未开始</span>
          </p>
          <p class="dictation-stage__hint">
            <span v-if="errorMessage" class="dictation-stage__error">{{ errorMessage }}</span>
            <span v-else>{{ statusMessage }}</span>
          </p>
        </div>

        <div class="dictation-stage__card">
          <p class="dictation-stage__card-title">提示</p>
          <div v-if="current" class="dictation-stage__card-body">
            <div v-if="mode === 'listening'" class="dictation-tts">
              <button type="button" class="dictation-tts__btn" :disabled="isLoading" @click="playWord">
                播放单词
              </button>
              <button
                type="button"
                class="dictation-tts__btn dictation-tts__btn--ghost"
                :disabled="isLoading || !current.exampleSentence"
                @click="playExample"
              >
                播放例句
              </button>
              <button type="button" class="dictation-tts__btn dictation-tts__btn--ghost" :disabled="isLoading" @click="stopTts">
                停止
              </button>
            </div>
            <p class="dictation-stage__definition">
              <span class="dictation-stage__tag">{{ current.pos || 'pos' }}</span>
              <span>{{ current.definition || '（暂无释义）' }}</span>
            </p>
            <p v-if="current.exampleSentence" class="dictation-stage__example">
              “{{ current.exampleSentence }}”
            </p>
            <p class="dictation-stage__source">
              来源：{{ current.bookName || '未命名词书' }} / {{ current.sourceName || 'manual-input' }}
            </p>
            <p class="dictation-stage__stats">
              听写次数：{{ current.dictationAttempts || 0 }}，答错次数：{{ current.failCount || 0 }}
            </p>
          </div>
          <div v-else class="dictation-stage__card-body dictation-stage__card-body--empty">
            <p>暂无进行中的听写。点击“开始听写”创建会话。</p>
          </div>
        </div>
      </div>

      <div class="dictation-input">
        <form class="dictation-input__form" @submit.prevent="submitAnswer">
          <label class="dictation-input__field">
            <span>Answer</span>
            <input
              v-model.trim="answer"
              class="dictation-input__input"
              placeholder="输入你听到的单词（lemma）"
              :disabled="isLoading || !current"
              autocomplete="off"
            />
          </label>
          <button type="submit" class="dictation-input__action" :disabled="isLoading || !current || !answer">
            {{ isLoading ? '校验中…' : '提交校验' }}
          </button>
        </form>

        <div class="dictation-result">
          <p class="dictation-result__label">反馈</p>
          <p class="dictation-result__value" :class="{ 'dictation-result__value--correct': lastResult.correct }">
            <span v-if="lastResult.text">{{ lastResult.text }}</span>
            <span v-else>等待提交答案…</span>
          </p>
        </div>

        <div class="dictation-actions">
          <button
            type="button"
            class="dictation-actions__btn dictation-actions__btn--ghost"
            :disabled="isLoading"
            @click="refreshSession"
          >
            刷新会话
          </button>
          <button
            type="button"
            class="dictation-actions__btn dictation-actions__btn--ghost"
            :disabled="isLoading"
            @click="startDictation"
          >
            开始听写
          </button>
          <button
            type="button"
            class="dictation-actions__btn dictation-actions__btn--ghost"
            :disabled="isLoading || !current"
            @click="skipCurrent"
          >
            跳过
          </button>
          <button
            type="button"
            class="dictation-actions__btn"
            :disabled="isLoading"
            @click="resetSession"
          >
            重置会话
          </button>
        </div>
      </div>
    </div>
  </SectionCard>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import SectionCard from '@/components/common/SectionCard.vue'
import { dictationService } from '@/services/dictation.service.js'
import { libraryService } from '@/services/library.service.js'

const mode = ref('spelling')
const isLoading = ref(false)
const statusMessage = ref('准备就绪。')
const errorMessage = ref('')
const answer = ref('')

const books = ref([])
const includedBookNames = ref([])
const selectedWordIds = ref([])

const filterBookName = ref('')
const wordQuery = ref('')
const searchResults = ref([])
const isSearching = ref(false)
const searchError = ref('')

const session = reactive({
  queue: [],
  index: 0,
  scope: 'all',
  updatedAt: 0
})

const current = ref(null)
const lastResult = reactive({
  correct: false,
  text: ''
})

onMounted(() => {
  loadLibraryOptions()
  refreshSession()
})

async function loadLibraryOptions() {
  try {
    const payload = await libraryService.getOptions()
    books.value = Array.isArray(payload?.books) ? payload.books : []
  } catch (error) {
    books.value = []
  }
}

async function refreshSession() {
  errorMessage.value = ''
  isLoading.value = true
  try {
    const payload = await dictationService.getSession()
    applySessionPayload(payload)
    statusMessage.value = payload?.message || '会话已刷新。'
  } catch (error) {
    errorMessage.value = error.message || '刷新失败'
  } finally {
    isLoading.value = false
  }
}

async function startDictation() {
  errorMessage.value = ''
  lastResult.correct = false
  lastResult.text = ''
  isLoading.value = true
  try {
    const payload = await dictationService.startSession({
      includedBookNames: includedBookNames.value,
      wordIds: selectedWordIds.value
    })
    applySessionPayload(payload)
    statusMessage.value = payload?.message || '已开始听写。'
  } catch (error) {
    errorMessage.value = error.message || '开始失败'
  } finally {
    isLoading.value = false
  }
}

async function submitAnswer() {
  errorMessage.value = ''
  if (!current.value) {
    return
  }

  isLoading.value = true
  try {
    const payload = await dictationService.checkAnswer({ answer: answer.value })
    applySessionPayload(payload)
    lastResult.correct = Boolean(payload?.correct)
    lastResult.text = payload?.diff || (payload?.correct ? '正确。' : '错误。')
    answer.value = ''
    statusMessage.value = payload?.finished ? '本轮已完成。' : '继续下一题。'
  } catch (error) {
    errorMessage.value = error.message || '校验失败'
  } finally {
    isLoading.value = false
  }
}

async function skipCurrent() {
  errorMessage.value = ''
  lastResult.correct = false
  lastResult.text = ''
  isLoading.value = true
  try {
    const payload = await dictationService.skipCurrent()
    applySessionPayload(payload)
    statusMessage.value = payload?.message || '已跳过。'
  } catch (error) {
    errorMessage.value = error.message || '跳过失败'
  } finally {
    isLoading.value = false
  }
}

async function resetSession() {
  errorMessage.value = ''
  lastResult.correct = false
  lastResult.text = ''
  answer.value = ''
  isLoading.value = true
  try {
    const payload = await dictationService.resetSession()
    applySessionPayload(payload)
    statusMessage.value = payload?.message || '会话已重置。'
  } catch (error) {
    errorMessage.value = error.message || '重置失败'
  } finally {
    isLoading.value = false
  }
}

function applySessionPayload(payload) {
  if (payload?.session && typeof payload.session === 'object') {
    session.queue = Array.isArray(payload.session.queue) ? payload.session.queue : []
    session.index = Number(payload.session.index || 0)
    session.scope = 'all'
    session.updatedAt = Number(payload.session.updatedAt || 0)
  } else {
    session.queue = []
    session.index = 0
    session.scope = 'all'
    session.updatedAt = 0
  }

  current.value = payload?.current || null

  if (payload?.selection && typeof payload.selection === 'object') {
    const nextIncluded = Array.isArray(payload.selection.includedBookNames)
      ? payload.selection.includedBookNames
      : Array.isArray(payload.selection.bookNames)
        ? payload.selection.bookNames
        : []
    includedBookNames.value = nextIncluded
    selectedWordIds.value = Array.isArray(payload.selection.wordIds) ? payload.selection.wordIds : []
  }
}

function isWordSelected(id) {
  const wordId = Number(id)
  return selectedWordIds.value.includes(wordId)
}

function toggleSelectedWord(id) {
  const wordId = Number(id)
  if (!wordId) {
    return
  }
  if (isWordSelected(wordId)) {
    selectedWordIds.value = selectedWordIds.value.filter((x) => Number(x) !== wordId)
    return
  }
  selectedWordIds.value = Array.from(new Set([...selectedWordIds.value, wordId]))
}

function clearSelection() {
  includedBookNames.value = []
  selectedWordIds.value = []
  filterBookName.value = ''
}

async function searchWords() {
  searchError.value = ''
  isSearching.value = true
  try {
    const payload = await libraryService.listEntries({
      page: 1,
      pageSize: 50,
      bookName: filterBookName.value || undefined,
      query: wordQuery.value || undefined
    })
    searchResults.value = Array.isArray(payload?.items) ? payload.items : []
  } catch (error) {
    searchResults.value = []
    searchError.value = error.message || '搜索失败'
  } finally {
    isSearching.value = false
  }
}

function speak(text) {
  const value = String(text || '').trim()
  if (!value) {
    throw new Error('没有可播放的内容')
  }
  if (!('speechSynthesis' in window)) {
    throw new Error('当前浏览器不支持 TTS')
  }
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(value)
  utterance.lang = 'en-US'
  window.speechSynthesis.speak(utterance)
}

function playWord() {
  errorMessage.value = ''
  if (!current.value) {
    return
  }
  try {
    speak(current.value.lemma)
  } catch (error) {
    errorMessage.value = error.message || '播放失败'
  }
}

function playExample() {
  errorMessage.value = ''
  if (!current.value) {
    return
  }
  try {
    speak(current.value.exampleSentence)
  } catch (error) {
    errorMessage.value = error.message || '播放失败'
  }
}

function stopTts() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
}
</script>

<style scoped>
.dictation-header {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.dictation-header__field {
  display: grid;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.dictation-header__select {
  min-width: 160px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  color: var(--color-text);
}

.dictation-selection {
  margin-bottom: 18px;
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-strong);
  display: grid;
  gap: 14px;
}

.dictation-selection__title {
  display: grid;
  gap: 6px;
}

.dictation-selection__heading {
  margin: 0;
  font-weight: 700;
}

.dictation-selection__summary {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.86rem;
}

.dictation-selection__grid {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 16px;
}

.dictation-selection__panel {
  display: grid;
  gap: 10px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.5);
}

.dictation-selection__label {
  margin: 0;
  font-size: 0.86rem;
  color: var(--color-text-muted);
}

.dictation-selection__books {
  display: grid;
  gap: 8px;
  max-height: 220px;
  overflow: auto;
}

.dictation-selection__book {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  align-items: center;
}

.dictation-selection__book-meta {
  color: var(--color-text-muted);
  font-size: 0.85rem;
}

.dictation-selection__search {
  display: grid;
  grid-template-columns: 1fr 2fr auto auto;
  gap: 10px;
  align-items: end;
}

.dictation-selection__field {
  display: grid;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.dictation-selection__select,
.dictation-selection__input {
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  color: var(--color-text);
}

.dictation-selection__btn {
  padding: 10px 14px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: var(--color-primary);
  color: #fffaf2;
  cursor: pointer;
  white-space: nowrap;
}

.dictation-selection__btn--ghost {
  border-color: var(--color-border);
  background: transparent;
  color: var(--color-text);
}

.dictation-selection__results {
  display: grid;
  gap: 8px;
  max-height: 240px;
  overflow: auto;
}

.dictation-selection__result {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.8);
}

.dictation-selection__result-main {
  display: grid;
  gap: 2px;
}

.dictation-selection__lemma {
  font-weight: 700;
}

.dictation-selection__hint {
  color: var(--color-text-muted);
  font-size: 0.86rem;
}

.dictation-selection__stats {
  color: var(--color-text-muted);
  font-size: 0.82rem;
  text-align: right;
}

.dictation-selection__empty {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.86rem;
}

.dictation-selection__error {
  margin: 0;
  color: #8a2f2f;
  font-size: 0.86rem;
}

.dictation-grid {
  display: grid;
  gap: 18px;
  grid-template-columns: 1.2fr 0.8fr;
  align-items: start;
}

.dictation-stage {
  display: grid;
  gap: 16px;
}

.dictation-stage__meta {
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-strong);
}

.dictation-stage__label,
.dictation-stage__value,
.dictation-stage__hint {
  margin: 0;
}

.dictation-stage__label {
  margin-bottom: 6px;
  color: var(--color-text-muted);
  font-size: 0.86rem;
}

.dictation-stage__value {
  font-weight: 600;
}

.dictation-stage__hint {
  margin-top: 6px;
  color: var(--color-text-muted);
}

.dictation-stage__error {
  color: #8a2f2f;
}

.dictation-stage__card {
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-strong);
}

.dictation-stage__card-title {
  margin: 0 0 10px;
  color: var(--color-text-muted);
  font-size: 0.86rem;
}

.dictation-stage__card-body {
  display: grid;
  gap: 10px;
}

.dictation-tts {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.dictation-tts__btn {
  padding: 10px 14px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: var(--color-primary);
  color: #fffaf2;
  cursor: pointer;
}

.dictation-tts__btn--ghost {
  border-color: var(--color-border);
  background: transparent;
  color: var(--color-text);
}

.dictation-stage__card-body--empty {
  color: var(--color-text-muted);
}

.dictation-stage__definition,
.dictation-stage__example,
.dictation-stage__source,
.dictation-stage__stats {
  margin: 0;
}

.dictation-stage__definition {
  display: grid;
  gap: 10px;
  grid-template-columns: auto 1fr;
  align-items: start;
}

.dictation-stage__tag {
  display: inline-flex;
  align-items: center;
  height: 24px;
  padding: 0 10px;
  border-radius: 999px;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.dictation-stage__example {
  color: var(--color-text-muted);
}

.dictation-stage__source {
  color: var(--color-text-muted);
  font-size: 0.86rem;
}

.dictation-input {
  display: grid;
  gap: 16px;
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-strong);
}

.dictation-input__form {
  display: grid;
  gap: 10px;
}

.dictation-input__field {
  display: grid;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.dictation-input__input {
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  color: var(--color-text);
}

.dictation-input__action {
  padding: 12px 18px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: var(--color-primary);
  color: #fffaf2;
  cursor: pointer;
}

.dictation-input__action:disabled {
  background: #c6b8aa;
  cursor: not-allowed;
}

.dictation-result__label,
.dictation-result__value {
  margin: 0;
}

.dictation-result__label {
  color: var(--color-text-muted);
  font-size: 0.86rem;
}

.dictation-result__value {
  margin-top: 6px;
  font-weight: 600;
}

.dictation-result__value--correct {
  color: var(--color-success);
}

.dictation-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.dictation-actions__btn {
  padding: 12px 18px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: var(--color-primary);
  color: #fffaf2;
  cursor: pointer;
}

.dictation-actions__btn--ghost {
  border-color: var(--color-border);
  background: transparent;
  color: var(--color-text);
}

.dictation-actions__btn:disabled {
  background: #c6b8aa;
  cursor: not-allowed;
}

@media (max-width: 900px) {
  .dictation-selection__grid {
    grid-template-columns: 1fr;
  }

  .dictation-selection__search {
    grid-template-columns: 1fr;
    align-items: stretch;
  }

  .dictation-grid {
    grid-template-columns: 1fr;
  }
}
</style>
