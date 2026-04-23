<template>
  <SectionCard
    title="听写"
    eyebrow="Dictation"
    description="开始一轮听写 → 查看当前提示 → 输入答案校验 → 跳过 / 重置会话。"
  >
    <template #header-extra>
      <div class="dictation-header">
        <label class="dictation-header__field">
          <span>Scope</span>
          <select v-model="scope" class="dictation-header__select">
            <option value="due">due</option>
            <option value="all">all</option>
          </select>
        </label>
      </div>
    </template>

    <div class="dictation-grid">
      <div class="dictation-stage">
        <div class="dictation-stage__meta">
          <p class="dictation-stage__label">当前进度</p>
          <p class="dictation-stage__value">
            <span v-if="session.queue.length">
              {{ session.index + 1 }} / {{ session.queue.length }}（{{ session.scope }}）
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

const scope = ref('due')
const isLoading = ref(false)
const statusMessage = ref('准备就绪。')
const errorMessage = ref('')
const answer = ref('')

const session = reactive({
  queue: [],
  index: 0,
  scope: 'due',
  updatedAt: 0
})

const current = ref(null)
const lastResult = reactive({
  correct: false,
  text: ''
})

onMounted(() => {
  refreshSession()
})

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
    const payload = await dictationService.startSession({ scope: scope.value })
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
    session.scope = payload.session.scope === 'all' ? 'all' : 'due'
    session.updatedAt = Number(payload.session.updatedAt || 0)
  } else {
    session.queue = []
    session.index = 0
    session.scope = 'due'
    session.updatedAt = 0
  }

  current.value = payload?.current || null
}
</script>

<style scoped>
.dictation-header {
  display: flex;
  justify-content: flex-end;
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

.dictation-stage__card-body--empty {
  color: var(--color-text-muted);
}

.dictation-stage__definition,
.dictation-stage__example,
.dictation-stage__source {
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
  .dictation-grid {
    grid-template-columns: 1fr;
  }
}
</style>

