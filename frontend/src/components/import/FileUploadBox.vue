<template>
  <section class="import-block">
    <header class="import-block__header">
      <div>
        <h3 class="import-block__title">文件上传</h3>
        <p class="import-block__desc">
          这里只做静态交互演示，真实上传和解析后续由父组件接入。
        </p>
      </div>
    </header>

    <div class="upload-box">
      <input
        ref="fileInputRef"
        class="upload-box__input"
        type="file"
        accept=".txt,.pdf,.doc,.docx"
        @change="onFileChange"
      />

      <p class="upload-box__name">当前文件：{{ selectedFileName }}</p>

      <div class="upload-box__actions">
        <button type="button" class="upload-box__button" @click="triggerFileInput">
          选择文件
        </button>
        <button type="button" class="upload-box__button upload-box__button--ghost" @click="$emit('load-demo')">
          载入演示数据
        </button>
        <button type="button" class="upload-box__button upload-box__button--ghost" @click="$emit('clear')">
          清空
        </button>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  selectedFileName: {
    type: String,
    default: '未选择文件'
  }
})

const emit = defineEmits(['file-selected', 'load-demo', 'clear'])

const fileInputRef = ref(null)

function triggerFileInput() {
  fileInputRef.value?.click()
}

function onFileChange(event) {
  const [file] = event.target.files || []

  if (!file) {
    return
  }

  emit('file-selected', {
    name: file.name,
    size: file.size,
    type: file.type
  })

  event.target.value = ''
}
</script>

<style scoped>
.import-block {
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-strong);
}

.import-block__title,
.import-block__desc,
.upload-box__name {
  margin: 0;
}

.import-block__desc {
  margin-top: 6px;
  color: var(--color-text-muted);
}

.upload-box {
  display: grid;
  gap: 14px;
  margin-top: 18px;
}

.upload-box__input {
  display: none;
}

.upload-box__name {
  color: var(--color-text-muted);
}

.upload-box__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.upload-box__button {
  padding: 10px 16px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: var(--color-primary);
  color: #fffaf2;
  cursor: pointer;
}

.upload-box__button--ghost {
  border-color: var(--color-border);
  background: transparent;
  color: var(--color-text);
}
</style>
