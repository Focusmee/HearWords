<template>
  <div class="page-grid">
    <SectionCard
      title="学习报告"
      eyebrow="报告"
      description="根据真实听写记录、错词状态和记忆状态生成反馈，帮助你决定下一步练什么。"
    >
      <div class="report">
        <p v-if="errorMessage" class="report__error">{{ errorMessage }}</p>
        <div v-if="isLoading" class="report__empty">正在整理学习报告...</div>

        <div v-else-if="report" class="report__content">
          <section class="report-overview" aria-label="今日概览">
            <article class="report-stat">
              <span>今日听写</span>
              <strong>{{ overview.dictationCount }}</strong>
              <p>提交、跳过都会计入</p>
            </article>
            <article class="report-stat">
              <span>正确率</span>
              <strong>{{ overview.accuracy }}%</strong>
              <p>{{ overview.correctCount }} 个正确答案</p>
            </article>
            <article class="report-stat report-stat--warm">
              <span>新增错词</span>
              <strong>{{ overview.newWrongWords }}</strong>
              <p>今天首次进入错词本</p>
            </article>
            <article class="report-stat report-stat--green">
              <span>进入掌握</span>
              <strong>{{ overview.masteredWords }}</strong>
              <p>记忆状态更新为已掌握</p>
            </article>
            <article class="report-stat">
              <span>学习时长</span>
              <strong>{{ durationText }}</strong>
              <p>来自答题用时记录</p>
            </article>
          </section>

          <section class="report-suggestion" aria-label="学习建议">
            <div>
              <span class="report-suggestion__label">下一步建议</span>
              <h3>{{ report.suggestion?.title || '保持当前节奏' }}</h3>
              <p>{{ report.suggestion?.text || '继续完成今日任务。' }}</p>
            </div>
            <div class="report-actions">
              <button type="button" class="report-action report-action--primary" :disabled="isStarting || todayTaskIds.length === 0" @click="startTodayTask">
                返回今日任务
              </button>
              <button type="button" class="report-action" :disabled="isStarting || suggestionIds.length === 0" @click="startWords(suggestionIds)">
                开始针对练习
              </button>
              <button type="button" class="report-action" :disabled="isStarting || frequentWrongIds.length === 0" @click="startWords(frequentWrongIds)">
                练高频错词
              </button>
            </div>
          </section>

          <section class="report-section" aria-label="近 7 天趋势">
            <header class="report-section__header">
              <h3>近 7 天趋势</h3>
              <p>听写数量、正确率和新增错词。</p>
            </header>
            <div class="trend-list">
              <article v-for="day in report.trend" :key="day.date" class="trend-day">
                <span>{{ formatDate(day.date) }}</span>
                <strong>{{ day.dictationCount }}</strong>
                <div class="trend-day__bar" aria-hidden="true">
                  <i :style="{ width: `${Math.min(100, day.accuracy)}%` }" />
                </div>
                <small>正确率 {{ day.accuracy }}% · 新错词 {{ day.newWrongWords }}</small>
              </article>
            </div>
          </section>

          <section class="report-grid">
            <div class="report-section">
              <header class="report-section__header">
                <h3>高频错词 Top 5</h3>
                <p>来自当前错词状态，不是原始错误流水。</p>
              </header>
              <div v-if="topWrongWords.length" class="wrong-list">
                <article v-for="item in topWrongWords" :key="item.wordId" class="wrong-item">
                  <div>
                    <strong>{{ item.lemma }}</strong>
                    <span>{{ item.statusText }}</span>
                  </div>
                  <p>错 {{ item.totalWrongCount }} 次 · {{ formatRelativeTime(item.latestWrongAt) }}</p>
                </article>
              </div>
              <p v-else class="report__empty">暂时没有高频错词。继续听写后，这里会自动更新。</p>
            </div>

            <div class="report-section">
              <header class="report-section__header">
                <h3>错误类型</h3>
                <p>当前先区分拼写、空白/跳过和其他错误。</p>
              </header>
              <div class="error-types">
                <article v-for="item in report.errorTypeDistribution" :key="item.type" class="error-type">
                  <span>{{ item.label }}</span>
                  <strong>{{ item.count }}</strong>
                </article>
              </div>
            </div>
          </section>
        </div>

        <div v-else class="report__empty">
          暂时没有可展示的学习数据。先完成一次今日任务，报告会自动出现。
        </div>
      </div>
    </SectionCard>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import SectionCard from '@/components/common/SectionCard.vue'
import { dictationService } from '@/services/dictation.service.js'
import { learningReportService } from '@/services/learning-report.service.js'

const router = useRouter()

const report = ref(null)
const isLoading = ref(false)
const isStarting = ref(false)
const errorMessage = ref('')

const overview = computed(() => report.value?.todayOverview || {})
const topWrongWords = computed(() => Array.isArray(report.value?.topWrongWords) ? report.value.topWrongWords : [])
const todayTaskIds = computed(() => Array.isArray(report.value?.actionWordIds?.todayTask) ? report.value.actionWordIds.todayTask : [])
const frequentWrongIds = computed(() => Array.isArray(report.value?.actionWordIds?.frequentWrongWords) ? report.value.actionWordIds.frequentWrongWords : [])
const suggestionIds = computed(() => Array.isArray(report.value?.suggestion?.wordIds) ? report.value.suggestion.wordIds : [])

const durationText = computed(() => {
  const ms = Number(overview.value.learningDurationMs || 0)
  if (!ms) return '0 分钟'
  const minutes = Math.max(1, Math.round(ms / 60000))
  return `${minutes} 分钟`
})

async function loadReport() {
  isLoading.value = true
  errorMessage.value = ''
  try {
    report.value = await learningReportService.getReport()
  } catch (error) {
    report.value = null
    errorMessage.value = error?.message || '学习报告加载失败。'
  } finally {
    isLoading.value = false
  }
}

async function startTodayTask() {
  const task = report.value?.todayTask || {}
  const wordIds = Array.isArray(task.wordIds) ? task.wordIds : todayTaskIds.value
  await startWords(wordIds, task.items)
}

async function startWords(wordIds, taskItems = []) {
  const ids = Array.from(new Set((wordIds || []).map((id) => Number(id)).filter(Boolean)))
  if (!ids.length) return

  isStarting.value = true
  errorMessage.value = ''
  try {
    await dictationService.startSession({
      scope: 'learning-report',
      wordIds: ids,
      taskItems: Array.isArray(taskItems) ? taskItems : []
    })
    await router.push('/dictation')
  } catch (error) {
    errorMessage.value = error?.message || '练习启动失败。'
  } finally {
    isStarting.value = false
  }
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function formatRelativeTime(value) {
  const time = Number(value)
  if (!time) return '暂无记录'
  const diff = Math.max(0, Date.now() - time)
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return new Date(time).toLocaleDateString('zh-CN')
}

onMounted(() => {
  loadReport()
})
</script>

<style scoped>
.report,
.report__content {
  display: grid;
  gap: 18px;
}

.report-overview {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.report-stat,
.report-suggestion,
.report-section {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.58);
  box-shadow: 0 14px 26px rgba(90, 68, 47, 0.06);
}

.report-stat {
  min-height: 124px;
  padding: 16px;
}

.report-stat--warm {
  background: #fff3df;
}

.report-stat--green {
  background: #eef7e9;
}

.report-stat span,
.report-suggestion__label,
.report-section__header p,
.wrong-item p,
.trend-day small,
.report__empty {
  color: var(--color-text-muted);
}

.report-stat span,
.report-suggestion__label {
  font-size: 0.82rem;
  font-weight: 700;
}

.report-stat strong {
  display: block;
  margin-top: 8px;
  font-size: 1.8rem;
  line-height: 1;
}

.report-stat p,
.report-suggestion p,
.report-section__header p,
.wrong-item p,
.report__error,
.report__empty {
  margin: 0;
}

.report-stat p {
  margin-top: 10px;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.report-suggestion {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: center;
  padding: 18px;
  background:
    radial-gradient(circle at 12% 0%, rgba(255, 255, 255, 0.76), rgba(255, 255, 255, 0) 55%),
    #fffdf8;
}

.report-suggestion h3,
.report-section__header h3 {
  margin: 6px 0;
}

.report-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

.report-action {
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.64);
  color: var(--color-text);
  cursor: pointer;
}

.report-action--primary {
  border-color: transparent;
  background: var(--color-primary);
  color: #fffaf2;
}

.report-action:disabled {
  opacity: 0.58;
  cursor: not-allowed;
}

.report-section {
  display: grid;
  gap: 14px;
  padding: 18px;
}

.report-section__header {
  display: grid;
  gap: 2px;
}

.trend-list {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 10px;
}

.trend-day {
  min-width: 0;
  padding: 12px;
  border: 1px solid rgba(117, 88, 63, 0.12);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.54);
}

.trend-day span,
.trend-day small {
  display: block;
}

.trend-day strong {
  display: block;
  margin: 6px 0;
  font-size: 1.35rem;
}

.trend-day__bar {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(138, 90, 50, 0.1);
  margin-bottom: 8px;
}

.trend-day__bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-primary);
}

.report-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
  gap: 14px;
}

.wrong-list,
.error-types {
  display: grid;
  gap: 10px;
}

.wrong-item,
.error-type {
  padding: 12px;
  border: 1px solid rgba(117, 88, 63, 0.12);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.54);
}

.wrong-item {
  display: grid;
  gap: 6px;
}

.wrong-item div,
.error-type {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}

.wrong-item span {
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(138, 90, 50, 0.1);
  color: var(--color-primary);
  font-size: 0.78rem;
  font-weight: 700;
}

.error-type strong {
  font-size: 1.3rem;
}

.report__error,
.report__empty {
  padding: 14px 16px;
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.52);
}

.report__error {
  color: #8a2f2f;
}

@media (max-width: 1100px) {
  .report-overview,
  .trend-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .report-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 680px) {
  .report-overview,
  .trend-list {
    grid-template-columns: 1fr;
  }

  .report-suggestion {
    display: grid;
  }

  .report-actions {
    justify-content: flex-start;
  }
}
</style>
