<template>
  <div class="page-grid">
    <SectionCard
      title="今日任务"
      eyebrow="首页"
      :description="todayTask?.explanation || '系统会优先安排到期复习、最近错词和重点错词，不足时补充新词。'"
    >
      <template #header-extra>
        <div class="intensity-tabs" aria-label="训练强度">
          <button
            v-for="option in intensityOptions"
            :key="option.value"
            type="button"
            class="intensity-tabs__btn"
            :class="{ 'intensity-tabs__btn--active': intensity === option.value }"
            :disabled="isTaskLoading || isStarting"
            @click="changeIntensity(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </template>

      <div class="today-task">
        <p v-if="taskError" class="today-task__error">{{ taskError }}</p>

        <div v-if="isTaskLoading" class="today-task__empty">正在生成今日任务...</div>

        <div v-else class="today-task__content">
          <div class="today-task__hero">
            <div>
              <span class="today-task__label">建议训练</span>
              <strong>{{ taskCounts.totalWords }}</strong>
              <p>{{ intensityLabel }}强度 · 预计 {{ estimatedMinutes }} 分钟</p>
            </div>
            <button
              type="button"
              class="today-task__start"
              :disabled="isStarting || taskCounts.totalWords === 0"
              @click="startTodayTask"
            >
              {{ isStarting ? '正在准备...' : '开始今日听写' }}
            </button>
          </div>

          <div class="today-task__stats">
            <article class="today-task__stat">
              <span>新词</span>
              <strong>{{ taskCounts.newWords }}</strong>
              <p>还没有训练记录</p>
            </article>
            <article class="today-task__stat">
              <span>复习词</span>
              <strong>{{ taskCounts.reviewWords }}</strong>
              <p>已经到复习时间</p>
            </article>
            <article class="today-task__stat today-task__stat--warm">
              <span>重点错词</span>
              <strong>{{ taskCounts.importantWrongWords }}</strong>
              <p>高频错误或手动标记</p>
            </article>
            <article class="today-task__stat">
              <span>错词总数</span>
              <strong>{{ taskCounts.wrongWords }}</strong>
              <p>来自当前薄弱词</p>
            </article>
          </div>

          <div v-if="taskPreview.length" class="today-task__preview" aria-label="今日任务预览">
            <span v-for="item in taskPreview" :key="item.wordId" class="today-task__word">
              {{ item.lemma }}
            </span>
          </div>

          <div v-else class="today-task__empty">
            <strong>暂无可练单词。</strong>
            <span>可以先导入词库，或在词书中选择要训练的单词。</span>
            <RouterLink to="/import" class="today-task__empty-link">去导入单词</RouterLink>
          </div>
        </div>
      </div>
    </SectionCard>

    <SectionCard
      title="学习入口"
      description="从任务、词库、错词本进入不同训练场景。"
    >
      <div class="quick-links">
        <RouterLink to="/wrong-words" class="quick-link">打开错词本</RouterLink>
        <RouterLink to="/import" class="quick-link">前往导入模块</RouterLink>
        <RouterLink to="/library" class="quick-link">前往词库模块</RouterLink>
        <RouterLink to="/dictation" class="quick-link">前往听写模块</RouterLink>
      </div>
    </SectionCard>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import SectionCard from '@/components/common/SectionCard.vue'
import { dictationService } from '@/services/dictation.service.js'

const router = useRouter()

const intensityOptions = [
  { label: '轻量', value: 'light' },
  { label: '标准', value: 'standard' },
  { label: '冲刺', value: 'sprint' }
]

const intensity = ref('standard')
const todayTask = ref(null)
const isTaskLoading = ref(false)
const isStarting = ref(false)
const taskError = ref('')

const taskCounts = computed(() => ({
  totalWords: Number(todayTask.value?.counts?.totalWords || 0),
  newWords: Number(todayTask.value?.counts?.newWords || 0),
  reviewWords: Number(todayTask.value?.counts?.reviewWords || 0),
  wrongWords: Number(todayTask.value?.counts?.wrongWords || 0),
  importantWrongWords: Number(todayTask.value?.counts?.importantWrongWords || 0)
}))

const intensityLabel = computed(() => {
  return intensityOptions.find((option) => option.value === intensity.value)?.label || '标准'
})

const estimatedMinutes = computed(() => {
  if (!taskCounts.value.totalWords) return 0
  return Math.max(5, Math.ceil(taskCounts.value.totalWords * 0.6))
})

const taskPreview = computed(() => {
  return Array.isArray(todayTask.value?.items) ? todayTask.value.items.slice(0, 12) : []
})

async function loadTodayTask() {
  isTaskLoading.value = true
  taskError.value = ''
  try {
    todayTask.value = await dictationService.getTodayTask({ intensity: intensity.value })
  } catch (error) {
    todayTask.value = null
    taskError.value = error?.message || '今日任务生成失败。'
  } finally {
    isTaskLoading.value = false
  }
}

function changeIntensity(value) {
  if (intensity.value === value) return
  intensity.value = value
  loadTodayTask()
}

async function startTodayTask() {
  const task = todayTask.value
  const wordIds = Array.isArray(task?.wordIds) ? task.wordIds : []
  if (!wordIds.length) return

  isStarting.value = true
  taskError.value = ''
  try {
    await dictationService.startSession({
      scope: 'today-task',
      wordIds,
      taskItems: (Array.isArray(task.items) ? task.items : []).map((item) => ({
        wordId: item.wordId,
        labels: item.labels,
        reasonCodes: item.reasonCodes
      }))
    })
    await router.push('/dictation')
  } catch (error) {
    taskError.value = error?.message || '今日任务启动失败。'
  } finally {
    isStarting.value = false
  }
}

onMounted(() => {
  loadTodayTask()
})
</script>

<style scoped>
.today-task {
  display: grid;
  gap: 16px;
}

.intensity-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.intensity-tabs__btn,
.today-task__start {
  border: 1px solid var(--color-border);
  border-radius: 999px;
  cursor: pointer;
  transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease;
}

.intensity-tabs__btn {
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.55);
  color: var(--color-text);
}

.intensity-tabs__btn--active {
  border-color: rgba(138, 90, 50, 0.32);
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: 700;
}

.today-task__content {
  display: grid;
  gap: 16px;
}

.today-task__hero {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  align-items: center;
  padding: 20px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background:
    radial-gradient(circle at 14% 12%, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0) 56%),
    #fffdf8;
}

.today-task__label,
.today-task__stat span {
  color: var(--color-text-muted);
  font-size: 0.84rem;
  font-weight: 700;
}

.today-task__hero strong {
  display: block;
  margin-top: 6px;
  font-size: 2.8rem;
  line-height: 1;
}

.today-task__hero p,
.today-task__stat p,
.today-task__empty,
.today-task__error {
  margin: 0;
}

.today-task__hero p,
.today-task__stat p,
.today-task__empty {
  color: var(--color-text-muted);
}

.today-task__start {
  flex-shrink: 0;
  padding: 12px 18px;
  border-color: transparent;
  background: var(--color-primary);
  color: #fffaf2;
  font-weight: 700;
}

.intensity-tabs__btn:hover:not(:disabled),
.today-task__start:hover:not(:disabled) {
  transform: translateY(-1px);
}

.today-task__start:disabled,
.intensity-tabs__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.today-task__stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.today-task__stat {
  min-height: 118px;
  padding: 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.58);
}

.today-task__stat--warm {
  background: #fff3df;
}

.today-task__stat strong {
  display: block;
  margin: 8px 0 8px;
  font-size: 1.8rem;
  line-height: 1;
}

.today-task__preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.today-task__word {
  padding: 7px 11px;
  border: 1px solid rgba(138, 90, 50, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.58);
  color: var(--color-text);
  font-weight: 650;
}

.today-task__empty,
.today-task__error {
  display: grid;
  gap: 8px;
  padding: 14px 16px;
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.52);
}

.today-task__empty strong {
  color: var(--color-text);
}

.today-task__empty-link {
  width: fit-content;
  padding: 8px 12px;
  border-radius: 999px;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-weight: 700;
}

.today-task__error {
  color: #8a2f2f;
}

@media (max-width: 980px) {
  .today-task__stats {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .today-task__hero {
    display: grid;
  }

  .today-task__stats {
    grid-template-columns: 1fr;
  }
}
</style>
