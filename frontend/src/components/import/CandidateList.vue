<template>
  <section class="import-block">
    <header class="import-block__header">
      <div>
        <h3 class="import-block__title">候选词展示</h3>
        <p class="import-block__desc">
          当前为静态候选词列表，勾选变化通过事件回传给父组件。
        </p>
      </div>

      <div class="candidate-actions" v-if="candidateWords.length > 0">
        <button type="button" class="candidate-actions__button" @click="$emit('select-all')">
          全选
        </button>
        <button type="button" class="candidate-actions__button" @click="$emit('clear-selection')">
          清空选择
        </button>
      </div>
    </header>

    <ul v-if="candidateWords.length > 0" class="candidate-list">
      <li
        v-for="word in candidateWords"
        :key="word.id"
        class="candidate-list__item"
      >
        <label class="candidate-list__label">
          <input
            type="checkbox"
            :checked="selectedWordIds.includes(word.id)"
            @change="$emit('toggle-word', word.id)"
          />
          <span class="candidate-list__word">{{ word.word }}</span>
        </label>
        <span class="candidate-list__source">{{ word.source }}</span>
      </li>
    </ul>

    <p v-else class="candidate-list__empty">
      暂无候选词，请先选择文件或载入演示数据。
    </p>
  </section>
</template>

<script setup>
defineProps({
  candidateWords: {
    type: Array,
    default: () => []
  },
  selectedWordIds: {
    type: Array,
    default: () => []
  }
})

defineEmits(['toggle-word', 'select-all', 'clear-selection'])
</script>

<style scoped>
.import-block {
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-strong);
}

.import-block__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.import-block__title,
.import-block__desc,
.candidate-list__empty {
  margin: 0;
}

.import-block__desc,
.candidate-list__source,
.candidate-list__empty {
  color: var(--color-text-muted);
}

.import-block__desc {
  margin-top: 6px;
}

.candidate-actions {
  display: flex;
  gap: 8px;
}

.candidate-actions__button {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
}

.candidate-list {
  display: grid;
  gap: 10px;
  padding: 0;
  margin: 18px 0 0;
  list-style: none;
}

.candidate-list__item {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
}

.candidate-list__label {
  display: flex;
  gap: 10px;
  align-items: center;
}

.candidate-list__word {
  font-weight: 600;
}

.candidate-list__empty {
  margin-top: 18px;
}

@media (max-width: 720px) {
  .import-block__header,
  .candidate-list__item {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
