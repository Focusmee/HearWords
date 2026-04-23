<template>
  <SectionCard
    title="导入模块"
    eyebrow="Import"
    description="当前版本只演示组件拆分与静态交互流程，后续可在这里接入真实解析和保存接口。"
  >
    <div class="import-panel">
      <FileUploadBox
        :selected-file-name="selectedFileName"
        @file-selected="handleFileSelected"
        @load-demo="loadDemoContent"
        @clear="resetImportState"
      />

      <ParsePreview
        :preview-text="previewText"
        :selected-file-name="selectedFileName"
        @update:preview-text="handlePreviewTextChange"
      />

      <CandidateList
        :candidate-words="candidateWords"
        :selected-word-ids="selectedWordIds"
        @toggle-word="toggleWordSelection"
        @select-all="selectAllWords"
        @clear-selection="clearSelection"
      />

      <div class="import-panel__footer">
        <div class="import-panel__summary">
          <p class="import-panel__label">当前状态</p>
          <p class="import-panel__value">
            已选择 {{ selectedWordIds.length }} / {{ candidateWords.length }} 个候选词
          </p>
          <p class="import-panel__hint">
            {{ saveMessage }}
          </p>
        </div>

        <button
          type="button"
          class="import-panel__action"
          :disabled="selectedWordIds.length === 0"
          @click="confirmSelection"
        >
          确认保存（静态）
        </button>
      </div>
    </div>
  </SectionCard>
</template>

<script setup>
import { computed, ref } from 'vue'
import SectionCard from '@/components/common/SectionCard.vue'
import FileUploadBox from '@/components/import/FileUploadBox.vue'
import ParsePreview from '@/components/import/ParsePreview.vue'
import CandidateList from '@/components/import/CandidateList.vue'

const defaultPreviewText = `Welcome to HearWords.
This import panel currently demonstrates component boundaries.
You can edit the preview text, simulate parsing, and choose candidate words.`

const defaultCandidateWords = [
  { id: 1, word: 'welcome', source: 'demo parse' },
  { id: 2, word: 'demonstrates', source: 'demo parse' },
  { id: 3, word: 'component', source: 'demo parse' },
  { id: 4, word: 'preview', source: 'demo parse' },
  { id: 5, word: 'candidate', source: 'demo parse' },
  { id: 6, word: 'words', source: 'demo parse' }
]

const selectedFile = ref(null)
const previewText = ref(defaultPreviewText)
const candidateWords = ref([...defaultCandidateWords])
const selectedWordIds = ref(defaultCandidateWords.slice(0, 3).map((word) => word.id))
const saveMessage = ref('尚未执行保存，当前为静态交互演示。')

const selectedFileName = computed(() => {
  return selectedFile.value?.name || '未选择文件'
})

function handleFileSelected(file) {
  selectedFile.value = file
  previewText.value = `已选择文件：${file.name}

这里仍然是静态预览内容。
后续可在父组件中接入真实解析逻辑，并将结果继续传给子组件。`
  candidateWords.value = buildCandidateWords(file.name)
  selectedWordIds.value = candidateWords.value.slice(0, 2).map((word) => word.id)
  saveMessage.value = '文件已载入静态预览，请确认候选词。'
}

function loadDemoContent() {
  selectedFile.value = null
  previewText.value = defaultPreviewText
  candidateWords.value = [...defaultCandidateWords]
  selectedWordIds.value = defaultCandidateWords.slice(0, 3).map((word) => word.id)
  saveMessage.value = '已载入演示数据。'
}

function resetImportState() {
  selectedFile.value = null
  previewText.value = ''
  candidateWords.value = []
  selectedWordIds.value = []
  saveMessage.value = '导入状态已清空。'
}

function handlePreviewTextChange(value) {
  previewText.value = value
  saveMessage.value = '预览文本已更新，候选词列表保持静态演示状态。'
}

function toggleWordSelection(wordId) {
  if (selectedWordIds.value.includes(wordId)) {
    selectedWordIds.value = selectedWordIds.value.filter((id) => id !== wordId)
    return
  }

  selectedWordIds.value = [...selectedWordIds.value, wordId]
}

function selectAllWords() {
  selectedWordIds.value = candidateWords.value.map((word) => word.id)
}

function clearSelection() {
  selectedWordIds.value = []
}

function confirmSelection() {
  const selectedWords = candidateWords.value
    .filter((word) => selectedWordIds.value.includes(word.id))
    .map((word) => word.word)

  saveMessage.value = `已静态确认 ${selectedWords.length} 个词：${selectedWords.join('、')}`
}

function buildCandidateWords(fileName) {
  const baseName = fileName.replace(/\.[^.]+$/, '')
  const words = [baseName, 'import', 'preview', 'static', 'candidate', 'review']

  return words.map((word, index) => ({
    id: index + 1,
    word: word.toLowerCase(),
    source: 'file mock'
  }))
}
</script>

<style scoped>
.import-panel {
  display: grid;
  gap: 20px;
}

.import-panel__footer {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  padding: 18px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-strong);
}

.import-panel__summary {
  min-width: 0;
}

.import-panel__label,
.import-panel__value,
.import-panel__hint {
  margin: 0;
}

.import-panel__label {
  margin-bottom: 6px;
  color: var(--color-text-muted);
  font-size: 0.86rem;
}

.import-panel__value {
  font-weight: 600;
}

.import-panel__hint {
  margin-top: 6px;
  color: var(--color-text-muted);
}

.import-panel__action {
  flex-shrink: 0;
  padding: 12px 18px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: var(--color-primary);
  color: #fffaf2;
  cursor: pointer;
}

.import-panel__action:disabled {
  background: #c6b8aa;
  cursor: not-allowed;
}

@media (max-width: 720px) {
  .import-panel__footer {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
