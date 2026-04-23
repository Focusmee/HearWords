<template>
  <section class="import-block">
    <header class="import-block__header">
      <div>
        <h3 class="import-block__title">文本预览</h3>
        <p class="import-block__desc">
          当前来源：{{ selectedFileName }}
        </p>
      </div>
    </header>

    <textarea
      class="preview-textarea"
      :value="previewText"
      placeholder="这里显示解析后的文本预览内容"
      @input="emit('update:preview-text', $event.target.value)"
    />
  </section>
</template>

<script setup>
defineProps({
  previewText: {
    type: String,
    default: ''
  },
  selectedFileName: {
    type: String,
    default: '未选择文件'
  }
})

const emit = defineEmits(['update:preview-text'])
</script>

<style scoped>
.import-block {
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-strong);
}

.import-block__title,
.import-block__desc {
  margin: 0;
}

.import-block__desc {
  margin-top: 6px;
  color: var(--color-text-muted);
}

.preview-textarea {
  width: 100%;
  min-height: 220px;
  margin-top: 18px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: 14px;
  background: #fffdf9;
  color: var(--color-text);
  resize: vertical;
}
</style>
