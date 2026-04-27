<template>
  <div class="retro-wrap">
    <div class="retro-header">
      <div class="retro-header__title">
        <p class="retro-header__eyebrow">听写训练</p>
        <h2 class="retro-header__heading">复古磁带随身听</h2>
      </div>

      <div class="retro-header__controls">
        <div class="retro-settings" aria-label="语音设置">
          <label class="retro-toggle">
            <input v-model="ttsSettings.autoPlay" type="checkbox" class="retro-toggle__input" />
            <span class="retro-toggle__pill" aria-hidden="true" />
            <span class="retro-toggle__text">自动播放</span>
          </label>

          <label class="retro-slider">
            <span class="retro-slider__label">语速</span>
            <input
              v-model.number="ttsSettings.rate"
              class="retro-slider__input"
              type="range"
              min="0.7"
              max="1.3"
              step="0.05"
            />
            <span class="retro-slider__value">{{ ttsSettings.rate.toFixed(2) }}</span>
          </label>

          <label class="retro-slider">
            <span class="retro-slider__label">音高</span>
            <input
              v-model.number="ttsSettings.pitch"
              class="retro-slider__input"
              type="range"
              min="0.9"
              max="1.1"
              step="0.02"
            />
            <span class="retro-slider__value">{{ ttsSettings.pitch.toFixed(2) }}</span>
          </label>
        </div>
      </div>
    </div>

    <div class="retro-grid">
      <div class="retro-grid__player">
        <RetroCassettePlayer
          :book-text="bookSummary"
          :progress-text="progressSummary"
          :status-text="statusMessage"
          :error-text="errorMessage"
          :display-label="displayLabel"
          :display-text="displayWord"
          :detail-text="displayDetail"
          :is-playing="tts.isPlaying"
          :progress="progressRatio"
        >
          <template #controls>
            <div class="retro-controls">
              <DictationControlBar
                :disabled="isLoading || !current"
                :is-playing="tts.isPlaying"
                :can-skip="Boolean(current)"
                :can-show-answer="Boolean(current)"
                @play="handlePlay"
                @pause="handlePause"
                @replay="handleReplay"
                @skip="handleSkip"
                @toggle-answer="toggleAnswer"
              />

              <div class="retro-controls__extra">
                <button
                  type="button"
                  class="retro-mini-btn"
                  :disabled="isLoading || !current || !current.exampleSentence"
                  @click="handlePlayExample"
                >
                  播放例句
                </button>
              </div>
            </div>
          </template>

          <template #input>
            <div class="retro-input">
              <form class="retro-input__form" @submit.prevent="submitAnswer">
                <label class="retro-input__field">
                  <span class="retro-input__label">你的答案</span>
                  <input
                    ref="answerInputEl"
                    v-model.trim="answer"
                    class="retro-input__input"
                    placeholder="输入你听到的单词"
                    :disabled="isLoading || !current"
                    autocomplete="off"
                  />
                </label>
                <button type="submit" class="retro-input__submit" :disabled="isLoading || !current">
                  {{ isLoading ? '校验中…' : '提交校验' }}
                </button>
              </form>

              <div class="retro-feedback">
                <p class="retro-feedback__label">反馈</p>
                <p class="retro-feedback__value" :class="{ 'retro-feedback__value--correct': lastResult.correct }">
                  <span v-if="lastResult.text">{{ lastResult.text }}</span>
                  <span v-else>等待提交答案…</span>
                </p>
              </div>

              <div v-if="currentLabelTexts.length || currentMemoryStateText" class="retro-word-tags" aria-label="当前单词标签">
                <span v-if="currentMemoryStateText" class="retro-word-tag retro-word-tag--state">{{ currentMemoryStateText }}</span>
                <span v-for="label in currentLabelTexts" :key="label" class="retro-word-tag">{{ label }}</span>
              </div>
            </div>
          </template>
        </RetroCassettePlayer>
      </div>

      <div class="retro-grid__side">
        <DictationStatsCard
          :current-index="session.index"
          :total="session.queue.length"
          :remaining="remainingCount"
          :session-correct="runStats.correct"
          :session-wrong="runStats.wrong"
          :total-words="overallStats.totalWords"
          :due-words="overallStats.dueWords"
          :today-words="overallStats.todayWords"
        >
          <template #actions>
            <p class="retro-session-hint">{{ selectionHint }}</p>
            <div class="retro-session-actions">
              <button type="button" class="retro-session-actions__btn" :disabled="isLoading" @click="refreshSession">刷新</button>
              <button
                type="button"
                class="retro-session-actions__btn retro-session-actions__btn--primary"
                :disabled="isLoading"
                @click="startDictation"
              >
                开始
              </button>
              <button type="button" class="retro-session-actions__btn" :disabled="isLoading" @click="resetSession">重置</button>
              <button
                v-if="completedRecently"
                type="button"
                class="retro-session-actions__btn retro-session-actions__btn--report"
                :disabled="isLoading"
                @click="goReport"
              >
                查看学习报告
              </button>
            </div>
          </template>
        </DictationStatsCard>
      </div>
    </div>

    <details class="retro-drawer retro-drawer--under" :open="drawerOpen" @toggle="onDrawerToggle">
      <summary class="retro-drawer__summary">
        <span>出题范围与选词</span>
        <span class="retro-drawer__meta">词书 {{ includedBookNames.length }} / 单词 {{ selectedWordIds.length }}</span>
      </summary>

      <div class="retro-drawer__body">
        <div class="dictation-selection__grid">
          <div class="dictation-selection__panel">
            <div class="dictation-selection__panel-head">
              <p class="dictation-selection__label">词书（多选）</p>
              <div v-if="books.length" class="pager">
                <button type="button" class="pager__btn" :disabled="booksPage <= 1" @click="booksPage -= 1">上一页</button>
                <span class="pager__text">{{ booksPage }} / {{ booksTotalPages }}</span>
                <button type="button" class="pager__btn" :disabled="booksPage >= booksTotalPages" @click="booksPage += 1">下一页</button>
              </div>
            </div>

            <div v-if="books.length" class="dictation-selection__books">
              <label v-for="book in pagedBooks" :key="book.id" class="dictation-selection__book">
                <input v-model="includedBookNames" type="checkbox" :value="book.name" />
                <span>{{ book.name }}</span>
                <span class="dictation-selection__book-meta">({{ book.wordCount }})</span>
              </label>
            </div>
            <p v-else class="dictation-selection__empty">暂无词书。</p>
          </div>

          <div class="dictation-selection__panel">
            <div class="dictation-selection__panel-head">
              <p class="dictation-selection__label">选词（多选）</p>
              <div v-if="searchResults.length" class="pager">
                <button type="button" class="pager__btn" :disabled="searchPage <= 1" @click="searchPage -= 1">上一页</button>
                <span class="pager__text">{{ searchPage }} / {{ searchTotalPages }}</span>
                <button type="button" class="pager__btn" :disabled="searchPage >= searchTotalPages" @click="searchPage += 1">下一页</button>
              </div>
            </div>

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
                  placeholder="输入单词、原词或释义关键词"
                  :disabled="isSearching"
                  @keydown.enter.prevent="searchWords"
                />
              </label>
              <button type="button" class="dictation-selection__btn" :disabled="isSearching" @click="searchWords">
                {{ isSearching ? '搜索中…' : '搜索' }}
              </button>
              <button type="button" class="dictation-selection__btn dictation-selection__btn--ghost" :disabled="isSearching" @click="clearSelection">
                清空选择
              </button>
            </div>

            <p v-if="searchError" class="dictation-selection__error">{{ searchError }}</p>

            <div class="dictation-bulk">
              <button type="button" class="dictation-bulk__btn" :disabled="!pagedSearchResults.length" @click="selectAllSearchResults">
                全选当前页
              </button>
              <button type="button" class="dictation-bulk__btn" :disabled="!pagedSearchResults.length" @click="deselectAllSearchResults">
                全不选当前页
              </button>
              <button type="button" class="dictation-bulk__btn" :disabled="!pagedSearchResults.length" @click="invertSearchResults">
                反选当前页
              </button>
              <span class="dictation-bulk__hint">按住 Shift 进行范围选择（当前页）</span>
            </div>

            <div v-if="pagedSearchResults.length" class="dictation-selection__results">
              <label v-for="(entry, index) in pagedSearchResults" :key="entry.id" class="dictation-selection__result">
                <input
                  type="checkbox"
                  :checked="isWordSelected(entry.id)"
                  @click.prevent="toggleSelectedWordWithRange(entry.id, index, $event)"
                />
                <span class="dictation-selection__result-main">
                  <span class="dictation-selection__lemma">{{ entry.lemma }}</span>
                  <span class="dictation-selection__hint">{{ entry.definition || '（暂无释义）' }}</span>
                </span>
                <span class="dictation-selection__stats">次数 {{ entry.dictationAttempts || 0 }} / 错 {{ entry.failCount || 0 }}</span>
              </label>
            </div>
            <p v-else class="dictation-selection__empty">请先搜索，再勾选要加入听写的单词（词书仅用于范围筛选，不自动入队）。</p>
          </div>

          <div class="dictation-selection__panel">
            <p class="dictation-selection__label">词书预览（单本）</p>
            <p v-if="!includedBookNames.length" class="dictation-selection__empty">先勾选至少 1 本词书，再预览。</p>
            <div v-else class="preview">
              <div class="preview__row">
                <select v-model="preview.bookName" class="preview__select">
                  <option v-for="name in includedBookNames" :key="name" :value="name">{{ name }}</option>
                </select>
                <button type="button" class="preview__btn" :disabled="preview.isLoading" @click="refreshPreview">
                  {{ preview.isLoading ? '预览中…' : '预览/刷新' }}
                </button>
              </div>
              <p v-if="preview.error" class="dictation-selection__error">{{ preview.error }}</p>
              <div v-if="preview.items.length" class="preview__list" role="list">
                <div v-for="item in preview.items" :key="item.id" class="preview__item" role="listitem">
                  <span class="preview__lemma">{{ item.lemma }}</span>
                  <span class="preview__def">{{ item.definition || '（暂无释义）' }}</span>
                </div>
              </div>
              <p v-else class="dictation-selection__empty">最多展示 50 个词条。</p>
            </div>
          </div>
        </div>
      </div>
    </details>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import DictationControlBar from '@/components/dictation/DictationControlBar.vue'
import DictationStatsCard from '@/components/dictation/DictationStatsCard.vue'
import RetroCassettePlayer from '@/components/dictation/RetroCassettePlayer.vue'
import { dictationService } from '@/services/dictation.service.js'
import { libraryService } from '@/services/library.service.js'

const router = useRouter()

const isLoading = ref(false)
const statusMessage = ref('准备就绪。')
const errorMessage = ref('')
const answer = ref('')
const answerInputEl = ref(null)

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

const ui = reactive({
  showAnswer: false
})

const ttsSettings = reactive({
  autoPlay: true,
  rate: 1.0,
  pitch: 1.0
})

const drawerOpen = ref(true)
const drawerTouched = ref(false)
const answerStartedAt = ref(0)
const completedRecently = ref(false)

const tts = reactive({
  isPlaying: false,
  token: 0
})

const preview = reactive({
  bookName: '',
  items: [],
  isLoading: false,
  error: ''
})

const selectionUi = reactive({
  lastClickedIndex: null
})

const booksPage = ref(1)
const booksPageSize = ref(6)

const searchPage = ref(1)
const searchPageSize = ref(10)

const runStats = reactive({
  correct: 0,
  wrong: 0
})

const overallStats = reactive({
  totalWords: 0,
  dueWords: 0,
  todayWords: 0
})

let autoplayTimer = null

onMounted(() => {
  hydrateTtsSettings()
  loadLibraryOptions()
  refreshSession()
  window.addEventListener('keydown', handleGlobalKeydown, { passive: false })
})

onBeforeUnmount(() => {
  stopTts()
  if (autoplayTimer) {
    clearTimeout(autoplayTimer)
    autoplayTimer = null
  }
  window.removeEventListener('keydown', handleGlobalKeydown)
})

watch(current, async () => {
  ui.showAnswer = false
  tts.isPlaying = false
  answerStartedAt.value = current.value ? Date.now() : 0
  await nextTick()
  if (answerInputEl.value && current.value) {
    try {
      answerInputEl.value.focus()
    } catch {
      // ignore
    }
  }
})

watch(
  () => includedBookNames.value.join('|'),
  () => {
    if (!preview.bookName || !includedBookNames.value.includes(preview.bookName)) {
      preview.bookName = includedBookNames.value[0] || ''
      preview.items = []
      preview.error = ''
    }
  },
  { immediate: true }
)

watch(
  () => books.value.length,
  () => {
    booksPage.value = 1
  }
)

watch(
  () => searchResults.value.length,
  () => {
    searchPage.value = 1
    selectionUi.lastClickedIndex = null
  }
)

watch(
  () => booksPage.value,
  () => {
    const max = booksTotalPages.value
    if (booksPage.value > max) booksPage.value = max
    if (booksPage.value < 1) booksPage.value = 1
  }
)

watch(
  () => searchPage.value,
  () => {
    const max = searchTotalPages.value
    if (searchPage.value > max) searchPage.value = max
    if (searchPage.value < 1) searchPage.value = 1
    selectionUi.lastClickedIndex = null
  }
)

watch(
  () => ({ ...ttsSettings }),
  () => persistTtsSettings(),
  { deep: true }
)

watch(
  () => current.value?.id,
  () => {
    if (!ttsSettings.autoPlay) return
    if (!current.value) return
    if (isLoading.value) return
    scheduleAutoplay()
  }
)

watch(
  () => session.queue.length,
  (length) => {
    if (!drawerTouched.value) {
      drawerOpen.value = length === 0
    }
  },
  { immediate: true }
)

function onDrawerToggle(event) {
  drawerTouched.value = true
  drawerOpen.value = Boolean(event?.target?.open)
}

function scheduleAutoplay() {
  if (autoplayTimer) {
    clearTimeout(autoplayTimer)
    autoplayTimer = null
  }
  const currentId = current.value?.id
  autoplayTimer = setTimeout(() => {
    autoplayTimer = null
    if (!ttsSettings.autoPlay) return
    if (!current.value || current.value?.id !== currentId) return
    handlePlay()
  }, 220)
}

async function loadLibraryOptions() {
  try {
    const payload = await libraryService.getOptions()
    books.value = Array.isArray(payload?.books) ? payload.books : []
  } catch {
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
    completedRecently.value = false
    resetRunStats()
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
    completedRecently.value = false
    resetRunStats()
    scheduleAutoplay()
  } catch (error) {
    errorMessage.value = error.message || '开始失败'
  } finally {
    isLoading.value = false
  }
}

async function submitAnswer() {
  errorMessage.value = ''
  if (!current.value) return

  isLoading.value = true
  try {
    const payload = await dictationService.checkAnswer({ answer: answer.value, answerDurationMs: getAnswerDurationMs() })
    applySessionPayload(payload)
    lastResult.correct = Boolean(payload?.correct)
    lastResult.text = payload?.diff || (payload?.correct ? '正确。' : '错误。')
    if (payload?.correct) runStats.correct += 1
    else runStats.wrong += 1
    answer.value = ''
    statusMessage.value = payload?.finished ? '本轮已完成。' : '继续下一题。'
    completedRecently.value = Boolean(payload?.finished)
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
    const payload = await dictationService.skipCurrent({ answerDurationMs: getAnswerDurationMs() })
    applySessionPayload(payload)
    runStats.wrong += 1
    statusMessage.value = payload?.message || '已跳过。'
    completedRecently.value = Boolean(payload?.finished)
    scheduleAutoplay()
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
    completedRecently.value = false
    resetRunStats()
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

  if (payload?.stats && typeof payload.stats === 'object') {
    overallStats.totalWords = Number(payload.stats.totalWords || 0)
    overallStats.dueWords = Number(payload.stats.dueWords || 0)
    overallStats.todayWords = Number(payload.stats.todayWords || 0)
  }
}

function isWordSelected(id) {
  const wordId = Number(id)
  return selectedWordIds.value.includes(wordId)
}

function toggleSelectedWord(id) {
  const wordId = Number(id)
  if (!wordId) return
  if (isWordSelected(wordId)) {
    selectedWordIds.value = selectedWordIds.value.filter((x) => Number(x) !== wordId)
    return
  }
  selectedWordIds.value = Array.from(new Set([...selectedWordIds.value, wordId]))
}

function toggleSelectedWordWithRange(id, index, event) {
  const wordId = Number(id)
  if (!wordId) return

  const hasRange = Boolean(event?.shiftKey) && selectionUi.lastClickedIndex !== null
  const last = selectionUi.lastClickedIndex
  selectionUi.lastClickedIndex = index

  if (!hasRange || last === null) {
    toggleSelectedWord(wordId)
    return
  }

  const start = Math.min(last, index)
  const end = Math.max(last, index)
  const shouldSelect = !isWordSelected(wordId)
  const rangeIds = pagedSearchResults.value.slice(start, end + 1).map((entry) => Number(entry.id)).filter(Boolean)

  const selected = new Set(selectedWordIds.value.map((x) => Number(x)))
  for (const rid of rangeIds) {
    if (shouldSelect) selected.add(rid)
    else selected.delete(rid)
  }
  selectedWordIds.value = Array.from(selected).filter((x) => Number(x) > 0)
}

function selectAllSearchResults() {
  const selected = new Set(selectedWordIds.value.map((x) => Number(x)))
  for (const entry of pagedSearchResults.value) {
    const id = Number(entry.id)
    if (id) selected.add(id)
  }
  selectedWordIds.value = Array.from(selected).filter((x) => Number(x) > 0)
}

function deselectAllSearchResults() {
  const remove = new Set(pagedSearchResults.value.map((entry) => Number(entry.id)).filter(Boolean))
  selectedWordIds.value = selectedWordIds.value.filter((x) => !remove.has(Number(x)))
}

function invertSearchResults() {
  const selected = new Set(selectedWordIds.value.map((x) => Number(x)))
  for (const entry of pagedSearchResults.value) {
    const id = Number(entry.id)
    if (!id) continue
    if (selected.has(id)) selected.delete(id)
    else selected.add(id)
  }
  selectedWordIds.value = Array.from(selected).filter((x) => Number(x) > 0)
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
    selectionUi.lastClickedIndex = null
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

  const myToken = (tts.token += 1)
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(value)
  utterance.lang = 'en-US'
  utterance.rate = clampNumber(ttsSettings.rate, 0.7, 1.3)
  utterance.pitch = clampNumber(ttsSettings.pitch, 0.9, 1.1)

  utterance.onstart = () => {
    if (myToken === tts.token) tts.isPlaying = true
  }
  utterance.onend = () => {
    if (myToken === tts.token) tts.isPlaying = false
  }
  utterance.onerror = () => {
    if (myToken === tts.token) tts.isPlaying = false
  }

  window.speechSynthesis.speak(utterance)
  tts.isPlaying = true
}

function playWord() {
  errorMessage.value = ''
  if (!current.value) return
  try {
    speak(current.value.lemma)
  } catch (error) {
    errorMessage.value = error.message || '播放失败'
  }
}

function playExample() {
  errorMessage.value = ''
  if (!current.value) return
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
  tts.isPlaying = false
}

function resetRunStats() {
  runStats.correct = 0
  runStats.wrong = 0
}

function toggleAnswer() {
  if (!current.value) return
  ui.showAnswer = !ui.showAnswer
}

function handlePlay() {
  playWord()
}

function handlePause() {
  stopTts()
}

function handleReplay() {
  playWord()
}

async function handleSkip() {
  stopTts()
  await skipCurrent()
}

function handlePlayExample() {
  playExample()
}

function goReport() {
  router.push('/report')
}

function getAnswerDurationMs() {
  const startedAt = Number(answerStartedAt.value || 0)
  if (!startedAt) return null
  return Math.max(0, Date.now() - startedAt)
}

async function refreshPreview() {
  preview.error = ''
  preview.items = []
  const bookName = String(preview.bookName || '').trim()
  if (!bookName) return
  preview.isLoading = true
  try {
    const payload = await libraryService.listEntries({ page: 1, pageSize: 50, bookName })
    preview.items = Array.isArray(payload?.items) ? payload.items : []
  } catch (error) {
    preview.items = []
    preview.error = error.message || '预览失败'
  } finally {
    preview.isLoading = false
  }
}

function hydrateTtsSettings() {
  try {
    const raw = localStorage.getItem('hearwords_dictation_tts_settings')
    if (!raw) return
    const parsed = JSON.parse(raw)
    if (typeof parsed?.autoPlay === 'boolean') ttsSettings.autoPlay = parsed.autoPlay
    if (typeof parsed?.rate === 'number') ttsSettings.rate = parsed.rate
    if (typeof parsed?.pitch === 'number') ttsSettings.pitch = parsed.pitch
  } catch {
    // ignore
  }
}

function persistTtsSettings() {
  try {
    localStorage.setItem(
      'hearwords_dictation_tts_settings',
      JSON.stringify({
        autoPlay: Boolean(ttsSettings.autoPlay),
        rate: Number(ttsSettings.rate),
        pitch: Number(ttsSettings.pitch)
      })
    )
  } catch {
    // ignore
  }
}

function clampNumber(value, min, max) {
  const n = Number(value)
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

function isTypingTarget(element) {
  const tag = String(element?.tagName || '').toLowerCase()
  if (!tag) return false
  return tag === 'input' || tag === 'textarea' || tag === 'select' || element?.isContentEditable
}

function handleGlobalKeydown(event) {
  if (!event) return
  if (event.repeat) return
  if (event.metaKey || event.ctrlKey || event.altKey) return
  if (!current.value) return

  const active = document?.activeElement
  const typing = isTypingTarget(active)

  if (event.key === ' ' || event.code === 'Space') {
    if (typing) return
    event.preventDefault()
    if (tts.isPlaying) handlePause()
    else handlePlay()
    return
  }

  if (event.key === 'ArrowRight') {
    if (typing) return
    event.preventDefault()
    handleSkip()
    return
  }

  if (event.key === 'a' || event.key === 'A') {
    if (typing) return
    event.preventDefault()
    toggleAnswer()
    return
  }

  if (event.key === 'Enter') {
    if (typing) return
    event.preventDefault()
    if (answer.value) submitAnswer()
    else {
      try {
        answerInputEl.value?.focus?.()
      } catch {
        // ignore
      }
    }
  }
}

const remainingCount = computed(() => {
  if (!session.queue.length) return 0
  return Math.max(0, session.queue.length - session.index - 1)
})

const progressRatio = computed(() => {
  if (!session.queue.length) return 0
  return session.index / session.queue.length
})

const progressSummary = computed(() => {
  if (!session.queue.length) return '未开始'
  return `${session.index + 1} / ${session.queue.length}`
})

const bookSummary = computed(() => {
  if (includedBookNames.value.length) {
    const joined = includedBookNames.value.join('、')
    return joined.length > 18 ? `${joined.slice(0, 18)}…` : joined
  }
  return filterBookName.value ? `范围：${filterBookName.value}` : '全库'
})

const selectionHint = computed(() => {
  const booksCount = includedBookNames.value.length
  const wordsCount = selectedWordIds.value.length
  if (!booksCount && !wordsCount) return '未指定范围：点击「开始」将使用全库。'
  return `已选择 ${booksCount} 本词书 + ${wordsCount} 个单词；点击「开始」后生效。`
})

const displayLabel = computed(() => '请听写这个单词')

const currentLabelTexts = computed(() => {
  const explicitTexts = Array.isArray(current.value?.taskLabelTexts) ? current.value.taskLabelTexts : []
  if (explicitTexts.length) return explicitTexts
  const labelTextMap = {
    new: '新词',
    review: '复习',
    wrong_word: '错词',
    important: '重点'
  }
  return (Array.isArray(current.value?.taskLabels) ? current.value.taskLabels : [])
    .map((label) => labelTextMap[label])
    .filter(Boolean)
})

const currentMemoryStateText = computed(() => {
  return current.value?.memoryStateText ? `记忆：${current.value.memoryStateText}` : ''
})

const booksTotalPages = computed(() => {
  const total = books.value.length
  const size = Math.max(1, Number(booksPageSize.value) || 1)
  return Math.max(1, Math.ceil(total / size))
})

const pagedBooks = computed(() => {
  const size = Math.max(1, Number(booksPageSize.value) || 1)
  const page = Math.min(booksTotalPages.value, Math.max(1, Number(booksPage.value) || 1))
  const start = (page - 1) * size
  return books.value.slice(start, start + size)
})

const searchTotalPages = computed(() => {
  const total = searchResults.value.length
  const size = Math.max(1, Number(searchPageSize.value) || 1)
  return Math.max(1, Math.ceil(total / size))
})

const pagedSearchResults = computed(() => {
  const size = Math.max(1, Number(searchPageSize.value) || 1)
  const page = Math.min(searchTotalPages.value, Math.max(1, Number(searchPage.value) || 1))
  const start = (page - 1) * size
  return searchResults.value.slice(start, start + size)
})

function maskWord(word) {
  const value = String(word || '')
  if (!value) return '—'
  const length = Math.min(12, value.length)
  return '•'.repeat(length) + (value.length > length ? '…' : '')
}

const displayWord = computed(() => {
  if (!current.value) return '未开始'
  if (ui.showAnswer) return String(current.value.lemma || '—')
  return maskWord(current.value.lemma)
})

const displayDetail = computed(() => {
  if (!current.value) return '点击「开始」创建一盘新的听写磁带。'
  const definition = current.value.definition ? String(current.value.definition) : '（暂无释义）'
  const source = `${current.value.bookName || '未命名词书'} / ${formatSourceName(current.value.sourceName)}`
  const statsText = `次数 ${current.value.dictationAttempts || 0} / 错 ${current.value.failCount || 0}`
  return `${definition} · ${source} · ${statsText}`
})

function formatSourceName(value) {
  const sourceName = String(value || '').trim()
  if (!sourceName || sourceName === 'manual-input') return '手动输入'
  return sourceName
}
</script>

<style scoped>
.retro-wrap {
  display: grid;
  gap: 16px;
  color: #000;
}

.retro-header {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: end;
  justify-content: space-between;
}

.retro-header__eyebrow {
  margin: 0;
  color: #9f9b93;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  font-size: 0.78rem;
}

.retro-header__heading {
  margin: 6px 0 0;
  font-weight: 950;
  letter-spacing: 0.2px;
  color: #000;
}

.retro-settings {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: flex-end;
}

.retro-toggle {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 999px;
  border: 1px solid #dad4c8;
  background: rgba(250, 249, 247, 0.75);
  box-shadow:
    rgba(0, 0, 0, 0.1) 0px 1px 1px,
    rgba(0, 0, 0, 0.04) 0px -1px 1px inset,
    rgba(0, 0, 0, 0.05) 0px -0.5px 1px;
  user-select: none;
  cursor: pointer;
}

.retro-toggle__input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.retro-toggle__pill {
  width: 40px;
  height: 22px;
  border-radius: 999px;
  border: 1px solid #dad4c8;
  background: rgba(255, 255, 255, 0.8);
  position: relative;
}

.retro-toggle__pill::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 999px;
  background: #fbbd41;
  box-shadow: rgb(0, 0, 0) -3px 3px;
  transition: transform 160ms ease, background 160ms ease;
}

.retro-toggle__input:checked + .retro-toggle__pill::after {
  transform: translateX(18px);
  background: #078a52;
}

.retro-toggle__text {
  color: #000;
  font-weight: 850;
  font-size: 0.9rem;
}

.retro-slider {
  display: grid;
  grid-template-columns: auto 130px auto;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 16px;
  border: 1px solid #dad4c8;
  background: rgba(250, 249, 247, 0.65);
  box-shadow:
    rgba(0, 0, 0, 0.1) 0px 1px 1px,
    rgba(0, 0, 0, 0.04) 0px -1px 1px inset,
    rgba(0, 0, 0, 0.05) 0px -0.5px 1px;
}

.retro-slider__label {
  color: #55534e;
  font-size: 0.82rem;
  font-weight: 850;
}

.retro-slider__input {
  width: 130px;
  accent-color: #078a52;
}

.retro-slider__value {
  font-variant-numeric: tabular-nums;
  font-weight: 950;
}

.retro-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 0.9fr);
  gap: 16px;
  align-items: start;
}

.retro-grid__side {
  position: sticky;
  top: 16px;
  padding-right: 0;
}

.retro-controls {
  display: grid;
  gap: 10px;
}

.retro-controls__extra {
  display: flex;
  justify-content: flex-end;
}

.retro-mini-btn {
  padding: 10px 14px;
  border-radius: 14px;
  border: 1px dashed #dad4c8;
  background: rgba(250, 249, 247, 0.6);
  color: #55534e;
  font-weight: 850;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease;
}

.retro-mini-btn:hover:not(:disabled) {
  transform: translateY(-1px) rotateZ(-2deg);
  box-shadow: rgb(0, 0, 0) -5px 5px;
}

.retro-mini-btn:active:not(:disabled) {
  transform: translateY(1px);
  box-shadow: rgb(0, 0, 0) -3px 3px;
}

.retro-mini-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.retro-input {
  display: grid;
  gap: 12px;
}

.retro-input__form {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  align-items: end;
}

.retro-input__field {
  display: grid;
  gap: 6px;
}

.retro-input__label {
  color: #55534e;
  font-size: 0.84rem;
  font-weight: 750;
}

.retro-input__input {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid #dad4c8;
  background: rgba(255, 255, 255, 0.86);
  color: #000;
  font-size: 1rem;
  box-shadow: inset rgba(0, 0, 0, 0.04) 0px -1px 1px;
}

.retro-input__submit {
  padding: 12px 16px;
  border-radius: 14px;
  border: 1px solid #dad4c8;
  background: #fbbd41;
  color: #000;
  font-weight: 950;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease;
  box-shadow: rgb(0, 0, 0) -6px 6px;
}

.retro-input__submit:hover:not(:disabled) {
  transform: translateY(-1px) rotateZ(-1deg);
}

.retro-input__submit:active:not(:disabled) {
  transform: translateY(1px);
  box-shadow: rgb(0, 0, 0) -3px 3px;
}

.retro-input__submit:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: rgb(0, 0, 0) -3px 3px;
}

.retro-feedback__label {
  margin: 0;
  color: #55534e;
  font-size: 0.82rem;
  font-weight: 750;
}

.retro-feedback__value {
  margin: 6px 0 0;
  font-weight: 900;
  color: #000;
}

.retro-feedback__value--correct {
  color: #078a52;
}

.retro-word-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.retro-word-tag {
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(7, 138, 82, 0.24);
  background: rgba(132, 231, 165, 0.24);
  color: #075b39;
  font-size: 0.82rem;
  font-weight: 900;
}

.retro-word-tag--state {
  border-color: rgba(59, 211, 253, 0.34);
  background: rgba(59, 211, 253, 0.2);
  color: #04526a;
}

.retro-session-hint {
  margin: 14px 0 0;
  color: #55534e;
  font-size: 0.9rem;
}

.retro-session-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}

.retro-session-actions__btn {
  flex: 1 1 auto;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid #dad4c8;
  background: rgba(250, 249, 247, 0.75);
  color: #000;
  font-weight: 900;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease;
  box-shadow: rgb(0, 0, 0) -5px 5px;
}

.retro-session-actions__btn--primary {
  background: #078a52;
  color: #fff;
}

.retro-session-actions__btn--report {
  background: #3bd3fd;
}

.retro-session-actions__btn:hover:not(:disabled) {
  transform: translateY(-1px) rotateZ(-1deg);
}

.retro-session-actions__btn:active:not(:disabled) {
  transform: translateY(1px);
  box-shadow: rgb(0, 0, 0) -3px 3px;
}

.retro-session-actions__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: rgb(0, 0, 0) -3px 3px;
}

.retro-drawer {
  margin-top: 14px;
  border-radius: 18px;
  border: 1px solid #dad4c8;
  background: rgba(250, 249, 247, 0.75);
  overflow: hidden;
  box-shadow:
    rgba(0, 0, 0, 0.1) 0px 1px 1px,
    rgba(0, 0, 0, 0.04) 0px -1px 1px inset,
    rgba(0, 0, 0, 0.05) 0px -0.5px 1px;
}

.retro-drawer--under {
  margin-top: 16px;
}

.retro-drawer__summary {
  cursor: pointer;
  list-style: none;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 14px;
  font-weight: 950;
}

.retro-drawer__summary::-webkit-details-marker {
  display: none;
}

.retro-drawer__meta {
  color: #55534e;
  font-weight: 800;
  font-size: 0.86rem;
}

.retro-drawer__body {
  padding: 14px;
  border-top: 1px solid #dad4c8;
  background:
    repeating-linear-gradient(45deg, rgba(0, 0, 0, 0.03), rgba(0, 0, 0, 0.03) 6px, rgba(255, 255, 255, 0.04) 6px, rgba(255, 255, 255, 0.04) 12px),
    rgba(250, 249, 247, 0.55);
}

.dictation-selection__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.dictation-selection__panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.pager {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.pager__btn {
  padding: 8px 10px;
  border-radius: 14px;
  border: 1px solid #dad4c8;
  background: rgba(250, 249, 247, 0.75);
  color: #000;
  font-weight: 900;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease;
  box-shadow: rgb(0, 0, 0) -3px 3px;
}

.pager__btn:hover:not(:disabled) {
  transform: translateY(-1px) rotateZ(-1deg);
  box-shadow: rgb(0, 0, 0) -4px 4px;
}

.pager__btn:active:not(:disabled) {
  transform: translateY(1px);
  box-shadow: rgb(0, 0, 0) -2px 2px;
}

.pager__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: rgb(0, 0, 0) -2px 2px;
}

.pager__text {
  color: #55534e;
  font-weight: 850;
  font-size: 0.86rem;
  font-variant-numeric: tabular-nums;
}

.dictation-selection__panel {
  display: grid;
  gap: 10px;
  padding: 12px;
  border-radius: 16px;
  border: 1px solid #dad4c8;
  background: rgba(255, 255, 255, 0.6);
}

.dictation-selection__label {
  margin: 0;
  font-weight: 950;
}

.dictation-selection__books,
.dictation-selection__results {
  display: grid;
  gap: 8px;
}

.dictation-selection__results {
  max-height: 420px;
  overflow: auto;
  padding-right: 2px;
}

.dictation-selection__book,
.dictation-selection__result {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid #eee9df;
  background: rgba(250, 249, 247, 0.8);
}

.dictation-selection__book-meta,
.dictation-selection__stats {
  margin-left: auto;
  font-size: 0.82rem;
  color: #55534e;
}

.dictation-selection__search {
  display: grid;
  grid-template-columns: 150px 1fr auto auto;
  gap: 10px;
  align-items: end;
}

.dictation-selection__field {
  display: grid;
  gap: 6px;
  font-size: 0.85rem;
  color: #55534e;
  font-weight: 750;
}

.dictation-selection__select,
.dictation-selection__input {
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid #dad4c8;
  background: rgba(255, 255, 255, 0.88);
  color: #000;
}

.dictation-selection__btn {
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid #dad4c8;
  background: #84e7a5;
  color: #000;
  font-weight: 950;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease;
  box-shadow: rgb(0, 0, 0) -4px 4px;
}

.dictation-selection__btn--ghost {
  border-style: dashed;
  background: rgba(250, 249, 247, 0.65);
}

.dictation-selection__btn:hover:not(:disabled) {
  transform: translateY(-1px) rotateZ(-1deg);
}

.dictation-selection__btn:active:not(:disabled) {
  transform: translateY(1px);
  box-shadow: rgb(0, 0, 0) -2px 2px;
}

.dictation-selection__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: rgb(0, 0, 0) -2px 2px;
}

.dictation-selection__error {
  margin: 0;
  color: #fc7981;
  font-size: 0.9rem;
  font-weight: 850;
}

.dictation-selection__empty {
  margin: 0;
  color: #55534e;
  font-size: 0.9rem;
}

.dictation-selection__result-main {
  display: grid;
  gap: 4px;
}

.dictation-selection__lemma {
  font-weight: 950;
}

.dictation-selection__hint {
  font-size: 0.85rem;
  color: #55534e;
}

.dictation-bulk {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 8px 0 4px;
}

.dictation-bulk__btn {
  padding: 8px 10px;
  border-radius: 14px;
  border: 1px solid #dad4c8;
  background: rgba(250, 249, 247, 0.75);
  color: #000;
  font-weight: 950;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease;
  box-shadow: rgb(0, 0, 0) -3px 3px;
}

.dictation-bulk__btn:hover:not(:disabled) {
  transform: translateY(-1px) rotateZ(-1deg);
  box-shadow: rgb(0, 0, 0) -4px 4px;
}

.dictation-bulk__btn:active:not(:disabled) {
  transform: translateY(1px);
  box-shadow: rgb(0, 0, 0) -2px 2px;
}

.dictation-bulk__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: rgb(0, 0, 0) -2px 2px;
}

.dictation-bulk__hint {
  color: #55534e;
  font-size: 0.82rem;
  font-weight: 750;
}

.preview {
  display: grid;
  gap: 10px;
}

.preview__row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
}

.preview__select {
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid #dad4c8;
  background: rgba(255, 255, 255, 0.88);
  color: #000;
}

.preview__btn {
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid #dad4c8;
  background: #3bd3fd;
  color: #000;
  font-weight: 950;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease;
  box-shadow: rgb(0, 0, 0) -4px 4px;
}

.preview__btn:hover:not(:disabled) {
  transform: translateY(-1px) rotateZ(-1deg);
}

.preview__btn:active:not(:disabled) {
  transform: translateY(1px);
  box-shadow: rgb(0, 0, 0) -2px 2px;
}

.preview__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  box-shadow: rgb(0, 0, 0) -2px 2px;
}

.preview__list {
  max-height: 280px;
  overflow: auto;
  display: grid;
  gap: 6px;
  padding-right: 2px;
}

.preview__item {
  display: grid;
  grid-template-columns: 0.9fr 1.1fr;
  gap: 10px;
  align-items: baseline;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid #eee9df;
  background: rgba(250, 249, 247, 0.8);
}

.preview__lemma {
  font-weight: 950;
}

.preview__def {
  color: #55534e;
  font-size: 0.88rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 900px) {
  .retro-grid {
    grid-template-columns: 1fr;
  }

  .retro-grid__side {
    position: static;
    padding-right: 0;
  }

  .dictation-selection__search {
    grid-template-columns: 1fr;
  }

  .retro-input__form {
    grid-template-columns: 1fr;
  }

  .retro-settings {
    justify-content: flex-start;
  }

  .retro-slider {
    grid-template-columns: auto 1fr auto;
  }

  .retro-slider__input {
    width: 100%;
  }
}

@media (min-width: 1000px) {
  .dictation-selection__grid {
    grid-template-columns: 1fr 1fr 0.9fr;
    align-items: start;
  }
}
</style>
