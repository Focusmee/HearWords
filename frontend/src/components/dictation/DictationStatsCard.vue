<template>
  <aside class="card" aria-label="学习状态">
    <header class="card__header">
      <p class="card__title">学习状态</p>
      <p class="card__sub">{{ subtitle }}</p>
    </header>

    <div class="card__grid">
      <div class="stat">
        <p class="stat__label">当前进度</p>
        <p class="stat__value">{{ progressText }}</p>
      </div>
      <div class="stat">
        <p class="stat__label">剩余数量</p>
        <p class="stat__value">{{ remaining }}</p>
      </div>
      <div class="stat">
        <p class="stat__label">本次正确</p>
        <p class="stat__value stat__value--good">{{ sessionCorrect }}</p>
      </div>
      <div class="stat">
        <p class="stat__label">本次错误</p>
        <p class="stat__value stat__value--bad">{{ sessionWrong }}</p>
      </div>
    </div>

    <div class="card__divider" />

    <div class="card__grid card__grid--compact">
      <div class="stat">
        <p class="stat__label">总词条</p>
        <p class="stat__value">{{ totalWords }}</p>
      </div>
      <div class="stat">
        <p class="stat__label">待复习</p>
        <p class="stat__value">{{ dueWords }}</p>
      </div>
      <div class="stat">
        <p class="stat__label">今日新词</p>
        <p class="stat__value">{{ todayWords }}</p>
      </div>
    </div>

    <slot name="actions" />
  </aside>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  currentIndex: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  remaining: { type: Number, default: 0 },
  sessionCorrect: { type: Number, default: 0 },
  sessionWrong: { type: Number, default: 0 },
  totalWords: { type: Number, default: 0 },
  dueWords: { type: Number, default: 0 },
  todayWords: { type: Number, default: 0 }
})

const progressText = computed(() => {
  if (!props.total) return '未开始'
  const current = Math.min(props.total, Math.max(0, props.currentIndex + 1))
  return `${current} / ${props.total}`
})

const subtitle = computed(() => {
  if (!props.total) return '放松点，先把磁带装进去'
  if (props.remaining <= 0) return '本轮完成，收工！'
  return '稳稳推进，今天也很棒'
})
</script>

<style scoped>
.card {
  border-radius: 18px;
  border: 1px solid rgba(201, 130, 66, 0.55);
  padding: 16px 16px 14px;
  background:
    radial-gradient(circle at 18% 10%, rgba(255, 255, 255, 0.65), rgba(255, 255, 255, 0) 55%),
    repeating-linear-gradient(45deg, rgba(80, 50, 20, 0.035), rgba(80, 50, 20, 0.035) 6px, rgba(255, 255, 255, 0.04) 6px, rgba(255, 255, 255, 0.04) 12px),
    #fdf1d6;
  color: #3f3428;
  box-shadow: 0 18px 34px rgba(80, 50, 20, 0.15);
}

.card__header {
  display: grid;
  gap: 6px;
  margin-bottom: 12px;
}

.card__title {
  margin: 0;
  font-weight: 850;
  letter-spacing: 0.3px;
}

.card__sub {
  margin: 0;
  color: #6d5a45;
  font-size: 0.92rem;
}

.card__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.card__grid--compact {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.stat {
  border-radius: 14px;
  border: 1px solid rgba(201, 130, 66, 0.35);
  padding: 10px 10px 9px;
  background: rgba(245, 232, 208, 0.55);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

.stat__label {
  margin: 0;
  color: #6d5a45;
  font-size: 0.82rem;
}

.stat__value {
  margin: 6px 0 0;
  font-weight: 900;
  letter-spacing: 0.2px;
  font-size: 1.08rem;
}

.stat__value--good {
  color: #2f6f4d;
}

.stat__value--bad {
  color: #8b3b2f;
}

.card__divider {
  height: 1px;
  background: rgba(201, 130, 66, 0.35);
  margin: 14px 0;
}

@media (max-width: 900px) {
  .card__grid--compact {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
