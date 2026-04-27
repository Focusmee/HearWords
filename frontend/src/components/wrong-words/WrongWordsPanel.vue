<template>
  <SectionCard
    title="错词本"
    eyebrow="复习"
    description="像整理学习桌上的错题卡一样，看看哪些单词还不稳、为什么错、下一步该练什么。"
  >
    <div class="wrong-panel">
      <section class="wrong-overview" aria-label="错词概览">
        <article class="wrong-stat">
          <span class="wrong-stat__label">当前薄弱词</span>
          <strong>{{ stats.currentCount }}</strong>
          <p>还需要继续复习</p>
        </article>
        <article class="wrong-stat">
          <span class="wrong-stat__label">今日新增</span>
          <strong>{{ stats.newTodayCount }}</strong>
          <p>今天新进入错词本</p>
        </article>
        <article class="wrong-stat wrong-stat--warm">
          <span class="wrong-stat__label">重点复习</span>
          <strong>{{ stats.importantReviewCount }}</strong>
          <p>高频错误或手动标记</p>
        </article>
        <article class="wrong-stat wrong-stat--green">
          <span class="wrong-stat__label">已掌握</span>
          <strong>{{ stats.masteredCount }}</strong>
          <p>已经从薄弱状态恢复</p>
        </article>
      </section>

      <section class="wrong-actions" aria-label="错词练习操作">
        <button type="button" class="wrong-action wrong-action--primary" :disabled="isLoading || practiceAllIds.length === 0" @click="practiceWords(practiceAllIds)">
          练习全部错词
        </button>
        <button type="button" class="wrong-action" :disabled="isLoading || importantIds.length === 0" @click="practiceWords(importantIds)">
          练习重点错词
        </button>
        <button type="button" class="wrong-action" :disabled="isLoading || todayIds.length === 0" @click="practiceWords(todayIds)">
          练习今日新增
        </button>
      </section>

      <div class="wrong-tabs" role="tablist" aria-label="错词状态筛选">
        <button
          v-for="tab in tabs"
          :key="tab.value || 'all'"
          type="button"
          class="wrong-tab"
          :class="{ 'wrong-tab--active': activeStatus === tab.value }"
          @click="activeStatus = tab.value"
        >
          <span>{{ tab.label }}</span>
          <small>{{ countForTab(tab.value) }}</small>
        </button>
      </div>

      <p v-if="errorMessage" class="wrong-error">{{ errorMessage }}</p>

      <div v-if="isLoading" class="wrong-empty">
        正在打开错词本...
      </div>

      <div v-else-if="filteredItems.length === 0" class="wrong-empty">
        <strong>这里暂时没有卡片。</strong>
        <span>听写中出现错误后，它们会自动整理成你的复习卡片。</span>
      </div>

      <section v-else class="wrong-card-grid" aria-label="错词卡片">
        <article v-for="item in filteredItems" :key="item.wordId" class="wrong-card" :class="`wrong-card--${item.status}`">
          <header class="wrong-card__header">
            <div class="wrong-card__wordline">
              <h3>{{ item.lemma }}</h3>
              <button type="button" class="wrong-card__sound" :disabled="!canSpeak" @click="speak(item.lemma)">
                发音
              </button>
            </div>
            <span class="wrong-card__tag">{{ statusLabel(item.status) }}</span>
          </header>

          <p class="wrong-card__definition">{{ item.definition || '暂无释义。' }}</p>

          <div class="wrong-card__reason">
            <div>
              <span>最近错答</span>
              <strong>{{ formatWrongAnswer(item) }}</strong>
            </div>
            <div>
              <span>错误次数</span>
              <strong>{{ item.totalWrongCount }}</strong>
            </div>
            <div>
              <span>最近出错</span>
              <strong>{{ formatTime(item.latestWrongAt) }}</strong>
            </div>
          </div>

          <footer class="wrong-card__footer">
            <button type="button" class="wrong-card__btn wrong-card__btn--primary" :disabled="isLoading" @click="practiceWords([item.wordId])">
              再练一次
            </button>
            <button type="button" class="wrong-card__btn" :disabled="isLoading || item.status === 'mastered'" @click="toggleImportant(item)">
              {{ item.isImportant || item.status === 'important_review' ? '取消重点' : '标为重点' }}
            </button>
            <button type="button" class="wrong-card__btn" :disabled="isLoading || item.status === 'mastered'" @click="markMastered(item)">
              标为已掌握
            </button>
          </footer>
        </article>
      </section>
    </div>
  </SectionCard>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import SectionCard from '@/components/common/SectionCard.vue'
import { dictationService } from '@/services/dictation.service.js'
import { wrongWordsService } from '@/services/wrong-words.service.js'

const router = useRouter()

const isLoading = ref(false)
const errorMessage = ref('')
const items = ref([])
const activeStatus = ref('')
const canSpeak = ref(typeof window !== 'undefined' && 'speechSynthesis' in window)

const stats = ref({
  total: 0,
  currentCount: 0,
  newTodayCount: 0,
  importantReviewCount: 0,
  masteredCount: 0,
  toConsolidateCount: 0,
  recoveringCount: 0
})

const tabs = [
  { label: '全部', value: '' },
  { label: '待巩固', value: 'to_consolidate' },
  { label: '重点复习', value: 'important_review' },
  { label: '恢复中', value: 'recovering' },
  { label: '已掌握', value: 'mastered' }
]

const filteredItems = computed(() => {
  if (!activeStatus.value) return items.value
  return items.value.filter((item) => item.status === activeStatus.value)
})

const practiceAllIds = computed(() => {
  return items.value
    .filter((item) => item.status !== 'mastered')
    .map((item) => Number(item.wordId))
    .filter(Boolean)
})

const importantIds = computed(() => {
  return items.value
    .filter((item) => item.status === 'important_review' || item.isImportant)
    .filter((item) => item.status !== 'mastered')
    .map((item) => Number(item.wordId))
    .filter(Boolean)
})

const todayIds = computed(() => {
  return items.value
    .filter((item) => item.isNewToday && item.status !== 'mastered')
    .map((item) => Number(item.wordId))
    .filter(Boolean)
})

async function load() {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const payload = await wrongWordsService.listWrongWords()
    items.value = Array.isArray(payload?.items) ? payload.items : []
    stats.value = { ...stats.value, ...(payload?.stats || {}) }
  } catch (error) {
    errorMessage.value = error?.message || '错词本加载失败。'
  } finally {
    isLoading.value = false
  }
}

async function practiceWords(wordIds) {
  const uniqueIds = Array.from(new Set((wordIds || []).map((id) => Number(id)).filter(Boolean)))
  if (!uniqueIds.length) return

  isLoading.value = true
  errorMessage.value = ''
  try {
    await dictationService.startSession({ wordIds: uniqueIds })
    await router.push('/dictation')
  } catch (error) {
    errorMessage.value = error?.message || '无法开始练习。'
  } finally {
    isLoading.value = false
  }
}

async function toggleImportant(item) {
  const next = !(item.isImportant || item.status === 'important_review')
  isLoading.value = true
  errorMessage.value = ''
  try {
    await wrongWordsService.setImportant(item.wordId, next)
    await load()
  } catch (error) {
    errorMessage.value = error?.message || '重点标记更新失败。'
  } finally {
    isLoading.value = false
  }
}

async function markMastered(item) {
  isLoading.value = true
  errorMessage.value = ''
  try {
    await wrongWordsService.markMastered(item.wordId)
    await load()
  } catch (error) {
    errorMessage.value = error?.message || '标记已掌握失败。'
  } finally {
    isLoading.value = false
  }
}

function speak(text) {
  const value = String(text || '').trim()
  if (!value || !canSpeak.value) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(value)
  utterance.lang = 'en-US'
  window.speechSynthesis.speak(utterance)
}

function countForTab(status) {
  if (!status) return stats.value.total || items.value.length
  return items.value.filter((item) => item.status === status).length
}

function statusLabel(status) {
  const map = {
    to_consolidate: '待巩固',
    important_review: '重点复习',
    recovering: '恢复中',
    mastered: '已掌握'
  }
  return map[status] || '待巩固'
}

function formatWrongAnswer(item) {
  if (item.errorType === 'skipped') return '跳过'
  if (item.errorType === 'blank') return '空白答案'
  return item.latestWrongAnswer || '无答案'
}

function formatTime(value) {
  const time = Number(value)
  if (!time) return '暂无记录'
  const date = new Date(time)
  const now = Date.now()
  const diff = Math.max(0, now - time)
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return date.toLocaleDateString('zh-CN')
}

onMounted(() => {
  load()
})
</script>

<style scoped>
.wrong-panel {
  display: grid;
  gap: 18px;
}

.wrong-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.wrong-stat {
  min-height: 130px;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background:
    radial-gradient(circle at 16% 12%, rgba(255, 255, 255, 0.78), rgba(255, 255, 255, 0) 56%),
    #fffdf8;
  box-shadow: 0 14px 26px rgba(90, 68, 47, 0.07);
}

.wrong-stat--warm {
  background:
    radial-gradient(circle at 16% 12%, rgba(255, 255, 255, 0.75), rgba(255, 255, 255, 0) 56%),
    #fff3df;
}

.wrong-stat--green {
  background:
    radial-gradient(circle at 16% 12%, rgba(255, 255, 255, 0.75), rgba(255, 255, 255, 0) 56%),
    #eef7e9;
}

.wrong-stat__label,
.wrong-stat p {
  color: var(--color-text-muted);
}

.wrong-stat__label {
  display: block;
  font-size: 0.82rem;
  font-weight: 700;
}

.wrong-stat strong {
  display: block;
  margin-top: 8px;
  font-size: 2rem;
  line-height: 1;
}

.wrong-stat p {
  margin: 10px 0 0;
  font-size: 0.9rem;
}

.wrong-actions,
.wrong-tabs,
.wrong-card__footer {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.wrong-action,
.wrong-tab,
.wrong-card__btn,
.wrong-card__sound {
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.6);
  color: var(--color-text);
  cursor: pointer;
  transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
}

.wrong-action {
  padding: 11px 15px;
}

.wrong-action--primary,
.wrong-card__btn--primary {
  border-color: transparent;
  background: var(--color-primary);
  color: #fffaf2;
}

.wrong-action:hover:not(:disabled),
.wrong-tab:hover,
.wrong-card__btn:hover:not(:disabled),
.wrong-card__sound:hover:not(:disabled) {
  transform: translateY(-1px);
  border-color: rgba(138, 90, 50, 0.3);
  background: var(--color-primary-soft);
}

.wrong-action--primary:hover:not(:disabled),
.wrong-card__btn--primary:hover:not(:disabled) {
  background: #7a4d2a;
}

.wrong-action:disabled,
.wrong-card__btn:disabled,
.wrong-card__sound:disabled {
  opacity: 0.58;
  cursor: not-allowed;
}

.wrong-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
}

.wrong-tab small {
  display: inline-grid;
  min-width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 999px;
  background: rgba(138, 90, 50, 0.1);
  color: var(--color-primary);
  font-size: 0.78rem;
}

.wrong-tab--active {
  border-color: rgba(138, 90, 50, 0.32);
  background: var(--color-primary-soft);
}

.wrong-error,
.wrong-empty {
  border: 1px dashed rgba(138, 90, 50, 0.24);
  border-radius: var(--radius-lg);
  padding: 18px;
  background: rgba(255, 255, 255, 0.52);
}

.wrong-error {
  color: #8a2f2f;
}

.wrong-empty {
  display: grid;
  gap: 6px;
  color: var(--color-text-muted);
}

.wrong-empty strong {
  color: var(--color-text);
}

.wrong-card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.wrong-card {
  position: relative;
  overflow: hidden;
  display: grid;
  gap: 14px;
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background:
    linear-gradient(90deg, rgba(138, 90, 50, 0.08) 0 6px, transparent 6px),
    radial-gradient(circle at 12% 0%, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0) 48%),
    #fffdf8;
  box-shadow: 0 18px 30px rgba(90, 68, 47, 0.08);
}

.wrong-card--important_review {
  background:
    linear-gradient(90deg, rgba(184, 79, 56, 0.28) 0 6px, transparent 6px),
    radial-gradient(circle at 12% 0%, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0) 48%),
    #fff5ea;
}

.wrong-card--recovering {
  background:
    linear-gradient(90deg, rgba(83, 126, 83, 0.24) 0 6px, transparent 6px),
    radial-gradient(circle at 12% 0%, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0) 48%),
    #f5fbef;
}

.wrong-card--mastered {
  opacity: 0.86;
}

.wrong-card__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.wrong-card__wordline {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.wrong-card__wordline h3 {
  margin: 0;
  font-size: 1.45rem;
  line-height: 1.1;
  word-break: break-word;
}

.wrong-card__sound {
  padding: 6px 10px;
  font-size: 0.82rem;
}

.wrong-card__tag {
  flex-shrink: 0;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(138, 90, 50, 0.12);
  color: var(--color-primary);
  font-size: 0.78rem;
  font-weight: 700;
}

.wrong-card__definition {
  margin: 0;
  color: var(--color-text-muted);
  line-height: 1.45;
}

.wrong-card__reason {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.wrong-card__reason div {
  min-width: 0;
  padding: 10px;
  border: 1px solid rgba(117, 88, 63, 0.12);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.56);
}

.wrong-card__reason span {
  display: block;
  color: var(--color-text-muted);
  font-size: 0.78rem;
}

.wrong-card__reason strong {
  display: block;
  margin-top: 5px;
  overflow-wrap: anywhere;
}

.wrong-card__btn {
  padding: 9px 12px;
  font-size: 0.9rem;
}

@media (max-width: 980px) {
  .wrong-overview,
  .wrong-card-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .wrong-overview,
  .wrong-card-grid,
  .wrong-card__reason {
    grid-template-columns: 1fr;
  }

  .wrong-card__header {
    display: grid;
  }
}
</style>
