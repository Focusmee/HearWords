<template>
  <SectionCard
    title="导入模块"
    eyebrow="导入"
    description="文件（txt / pdf / doc(x) / 图片）→ 提取 / OCR → 解析候选词 → 勾选 → 导入词库"
  >
    <template #header-extra>
      <div class="import-header">
        <label class="import-header__field">
          <span>来源</span>
          <input
            v-model.trim="sourceName"
            class="import-header__input"
            placeholder="例如：手动输入"
            list="source-options"
          />
          <datalist id="source-options">
            <option v-for="name in sourceNameOptions" :key="name" :value="name" :label="formatSourceName(name)" />
          </datalist>
        </label>
        <label class="import-header__field">
          <span>解析模式</span>
          <select v-model="mode" class="import-header__select">
            <option value="normal">普通</option>
            <option value="enhanced">增强</option>
          </select>
        </label>
        <label class="import-header__field">
          <span>候选数</span>
          <input
            v-model.number="parseLimit"
            class="import-header__input"
            type="number"
            min="10"
            :max="parseLimitMax"
            step="10"
          />
        </label>
      </div>
    </template>

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
        :candidate-words="visibleCandidates"
        :selected-word-ids="selectedWordIds"
        @toggle-word="toggleWordSelection"
        @select-all="selectAllWords"
        @clear-selection="clearSelection"
      />
      <div v-if="candidateWords.length > displayLimit" class="import-panel__more">
        <p class="import-panel__more-text">
          当前显示 {{ visibleCandidates.length }} / {{ candidateWords.length }} 个候选词
        </p>
        <button type="button" class="import-panel__more-button" @click="toggleShowAllCandidates">
          {{ showAllCandidates ? '收起显示' : '显示全部' }}
        </button>
      </div>

      <div class="import-panel__footer">
        <div class="import-panel__summary">
          <p class="import-panel__label">当前状态</p>
          <p class="import-panel__value">
            已选择 {{ selectedWordIds.length }} / {{ candidateWords.length }} 个候选词
          </p>
          <p class="import-panel__hint">
            <span v-if="warningMessage">{{ warningMessage }}</span>
            <span v-else>{{ saveMessage }}</span>
          </p>
          <p v-if="errorMessage" class="import-panel__error">{{ errorMessage }}</p>
        </div>

        <div class="import-panel__buttons">
          <div class="import-panel__autoselect">
            <input
              v-model.number="autoSelectCount"
              class="import-panel__autoselect-input"
              type="number"
              min="0"
              :max="candidateWords.length"
              step="10"
              placeholder="0"
            />
            <button
              type="button"
              class="import-panel__action import-panel__action--ghost"
              :disabled="candidateWords.length === 0 || !autoSelectCount || isLoading"
              @click="applyAutoSelect"
            >
              选前 N
            </button>
          </div>
          <button
            type="button"
            class="import-panel__action import-panel__action--ghost"
            :disabled="!previewText || isLoading"
            @click="runParse"
          >
            {{ isLoading ? '解析中…' : '解析候选词' }}
          </button>
          <button
            type="button"
            class="import-panel__action"
            :disabled="selectedWordIds.length === 0 || isLoading"
            @click="confirmSelection"
          >
            保存到词库
          </button>
        </div>
      </div>
    </div>
  </SectionCard>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import SectionCard from '@/components/common/SectionCard.vue'
import FileUploadBox from '@/components/import/FileUploadBox.vue'
import ParsePreview from '@/components/import/ParsePreview.vue'
import CandidateList from '@/components/import/CandidateList.vue'
import { importService } from '@/services/import.service.js'
import { appService } from '@/services/app.service.js'
import { settingsService } from '@/services/settings.service.js'
import { libraryService } from '@/services/library.service.js'

const defaultPreviewText = `欢迎使用 HearWords。
你可以在这里粘贴文本，或上传文件，然后点击“解析候选词”。`

const selectedFile = ref(null)
const previewText = ref(defaultPreviewText)
const candidateWords = ref([])
const selectedWordIds = ref([])
const saveMessage = ref('请选择文件或粘贴文本，然后解析候选词。')
const warningMessage = ref('')
const errorMessage = ref('')
const isLoading = ref(false)

const sourceName = ref('手动输入')
const mode = ref('normal')
const parseLimit = ref(300)
const parseLimitMax = ref(2000)
const autoSelectCount = ref(0)
const displayLimit = ref(200)
const showAllCandidates = ref(false)
const sourceNameOptions = ref([])
const libraryLemmaSet = ref(new Set())

const selectedFileName = computed(() => {
  return selectedFile.value?.name || '未选择文件'
})

const visibleCandidates = computed(() => {
  if (showAllCandidates.value) {
    return candidateWords.value
  }
  return candidateWords.value.slice(0, Math.max(10, Number(displayLimit.value) || 200))
})

async function handleFileSelected(file) {
  selectedFile.value = file
  warningMessage.value = ''
  errorMessage.value = ''

  if (!file) {
    return
  }

  if (file.size > 18 * 1024 * 1024) {
    errorMessage.value = '文件过大（>18MB），可能超过后端 JSON 解析限制。'
  }

  saveMessage.value = '已选择文件，正在读取…'
  candidateWords.value = []
  selectedWordIds.value = []

  try {
    if (isImageFile(file)) {
      const base64 = await readFileAsBase64(file)
      const ocr = await importService.ocrImage({ imageBase64: base64, filename: file.name })
      previewText.value = ocr?.text || ''
      saveMessage.value = `OCR 完成（可信度：${Math.round(Number(ocr?.confidence || 0))}）`
      return
    }

    if (isTextFile(file)) {
      previewText.value = await file.text()
      saveMessage.value = '文本已载入，可编辑后解析候选词。'
      return
    }

    const base64 = await readFileAsBase64(file)
    const extracted = await importService.extractDocument({ filename: file.name, fileBase64: base64 })
    previewText.value = extracted?.text || ''
    if (typeof extracted?.sourceName === 'string' && extracted.sourceName.trim()) {
      sourceName.value = extracted.sourceName.trim()
    }
    saveMessage.value = `已提取文档文本（${Number(extracted?.characterCount || 0)} 个字符）`
  } catch (error) {
    errorMessage.value = error.message || '文件处理失败'
    saveMessage.value = '文件处理失败，请检查后端服务是否启动。'
  }
}

function loadDemoContent() {
  selectedFile.value = null
  previewText.value = defaultPreviewText
  candidateWords.value = []
  selectedWordIds.value = []
  warningMessage.value = ''
  errorMessage.value = ''
  saveMessage.value = '已载入演示文本，可直接解析候选词。'
}

function resetImportState() {
  selectedFile.value = null
  previewText.value = ''
  candidateWords.value = []
  selectedWordIds.value = []
  warningMessage.value = ''
  errorMessage.value = ''
  saveMessage.value = '导入状态已清空。'
}

function handlePreviewTextChange(value) {
  previewText.value = value
  saveMessage.value = '预览文本已更新，可重新解析候选词。'
}

function toggleWordSelection(wordId) {
  if (selectedWordIds.value.includes(wordId)) {
    selectedWordIds.value = selectedWordIds.value.filter((id) => id !== wordId)
    return
  }

  selectedWordIds.value = [...selectedWordIds.value, wordId]
}

function selectAllWords() {
  selectedWordIds.value = visibleCandidates.value.map((word) => word.id)
}

function clearSelection() {
  selectedWordIds.value = []
}

async function runParse() {
  errorMessage.value = ''
  warningMessage.value = ''

  const text = String(previewText.value || '').trim()
  if (!text) {
    errorMessage.value = '没有可解析的文本。'
    return
  }

  isLoading.value = true
  try {
    const result = await importService.parseText({
      text,
      sourceName: sourceName.value,
      mode: mode.value,
      limit: parseLimit.value
    })
    candidateWords.value = Array.isArray(result?.candidates) ? result.candidates : []
    selectedWordIds.value = candidateWords.value.filter((item) => item.kept).map((item) => item.id)
    warningMessage.value = result?.warning || ''
    saveMessage.value = `解析完成：${candidateWords.value.length} 个候选词`
    showAllCandidates.value = false
  } catch (error) {
    errorMessage.value = error.message || '解析失败'
  } finally {
    isLoading.value = false
  }
}

async function confirmSelection() {
  errorMessage.value = ''
  warningMessage.value = ''

  const selectedEntries = candidateWords.value
    .filter((word) => selectedWordIds.value.includes(word.id))
    .map((word) => ({
      ...word,
      sourceName: sourceName.value || word.sourceName
    }))

  if (!selectedEntries.length) {
    errorMessage.value = '请先选择要导入的候选词。'
    return
  }

  const duplicates = []
  const unique = []
  const seen = new Set()
  for (const entry of selectedEntries) {
    const lemma = String(entry?.lemma || '').trim().toLowerCase()
    if (!lemma || seen.has(lemma)) {
      continue
    }
    seen.add(lemma)
    if (libraryLemmaSet.value.has(lemma)) {
      duplicates.push(lemma)
      continue
    }
    unique.push(entry)
  }

  if (!unique.length) {
    errorMessage.value = `所选候选词全部已在词库中（重复 ${duplicates.length} 个）。`
    return
  }

  isLoading.value = true
  try {
    const result = await importService.importLibrary({ entries: unique })
    if (Array.isArray(result?.items)) {
      libraryLemmaSet.value = new Set(result.items.map((item) => String(item.lemma || '').toLowerCase()).filter(Boolean))
    } else {
      for (const entry of unique) {
        libraryLemmaSet.value.add(String(entry.lemma || '').toLowerCase())
      }
    }
    const added = Number(result?.added || 0)
    const merged = Number(result?.merged || 0)
    const skipped = Number(result?.skipped || 0)
    const message = `已导入词库：新增 ${added}，合并 ${merged}，跳过重复 ${skipped}`
    const localSkippedHint = duplicates.length ? `（前端预检剔除重复 ${duplicates.length}）` : ''
    saveMessage.value = `${message}${localSkippedHint}`

    const serverDuplicates = Array.isArray(result?.duplicates) ? result.duplicates : []
    const shown = [...new Set([...duplicates, ...serverDuplicates])].slice(0, 12)
    warningMessage.value = shown.length ? `重复词（已剔除）：${shown.join('，')}${shown.length >= 12 ? '…' : ''}` : ''
  } catch (error) {
    errorMessage.value = error.message || '导入失败'
  } finally {
    isLoading.value = false
  }
}

function toggleShowAllCandidates() {
  showAllCandidates.value = !showAllCandidates.value
}

function applyAutoSelect() {
  const count = Math.max(0, Math.floor(Number(autoSelectCount.value) || 0))
  if (count <= 0) {
    return
  }
  const sorted = [...candidateWords.value].sort((a, b) => {
    const freqDiff = Number(b.frequency || 0) - Number(a.frequency || 0)
    if (freqDiff !== 0) {
      return freqDiff
    }
    return String(a.lemma || '').localeCompare(String(b.lemma || ''))
  })
  selectedWordIds.value = sorted.slice(0, Math.min(count, sorted.length)).map((item) => item.id)
}

function formatSourceName(value) {
  const sourceName = String(value || '').trim()
  if (!sourceName || sourceName === 'manual-input') return '手动输入'
  return sourceName
}

function isTextFile(file) {
  if (!file) {
    return false
  }
  if (file.type === 'text/plain') {
    return true
  }
  return /\.txt$/i.test(file.name || '')
}

function isImageFile(file) {
  if (!file) {
    return false
  }
  if (String(file.type || '').startsWith('image/')) {
    return true
  }
  return /\.(png|jpg|jpeg)$/i.test(file.name || '')
}

async function readFileAsBase64(file) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })

  const commaIndex = dataUrl.indexOf(',')
  return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : ''
}

onMounted(async () => {
  try {
    const [health, settings, library] = await Promise.all([
      appService.getHealth(),
      settingsService.getSettings(),
      libraryService.getLibrary()
    ])
    const nextMax = Number(settings?.import?.parseLimitMax)
    if (Number.isFinite(nextMax) && nextMax > 0) {
      parseLimitMax.value = nextMax
      if (parseLimit.value > nextMax) {
        parseLimit.value = nextMax
      }
    }
    if (Array.isArray(library?.items)) {
      libraryLemmaSet.value = new Set(library.items.map((item) => String(item.lemma || '').toLowerCase()).filter(Boolean))
    }
    if (Array.isArray(library?.sources)) {
      const sources = new Set()
      for (const option of library.sources) {
        if (option?.sourceName) {
          sources.add(option.sourceName)
        }
      }
      sourceNameOptions.value = [...sources].sort((a, b) => String(a).localeCompare(String(b)))
    }
    if (health && health.dictionaryReady === false) {
      warningMessage.value = '词典未初始化：请先运行 backend 的 setup:dictionary，再解析/导入。'
    }
  } catch {
    warningMessage.value = '后端服务未就绪：请先启动 backend。'
  }
})
</script>

<style scoped>
.import-panel {
  display: grid;
  gap: 20px;
}

.import-header {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

.import-header__field {
  display: grid;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.import-header__input,
.import-header__select {
  min-width: 160px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  color: var(--color-text);
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

.import-panel__error {
  margin: 10px 0 0;
  color: #8a2f2f;
  font-size: 0.92rem;
}

.import-panel__buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.import-panel__more {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  border: 1px dashed var(--color-border);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.35);
}

.import-panel__more-text {
  margin: 0;
  color: var(--color-text-muted);
}

.import-panel__more-button {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
}

.import-panel__autoselect {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.55);
}

.import-panel__autoselect-input {
  width: 96px;
  padding: 8px 10px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: transparent;
  color: var(--color-text);
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

.import-panel__action--ghost {
  border-color: var(--color-border);
  background: transparent;
  color: var(--color-text);
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

  .import-header {
    justify-content: flex-start;
  }
}
</style>
