<template>
  <SectionCard
    title="词库"
    eyebrow="词库"
    description="总词库查询、编辑、删除；并支持从总词库批量加入词书（N:M）"
  >
    <template #header-extra>
      <div class="library-header">
        <label class="library-header__field">
          <span>加入词书</span>
          <div class="library-header__assign">
            <select v-model="assign.bookIds" class="library-header__select" :disabled="isLoading" multiple>
              <option v-for="book in allBooks" :key="book.id" :value="String(book.id)">
                {{ book.name }}（{{ book.wordCount }}）
              </option>
            </select>
            <button
              type="button"
              class="library-header__action"
              :disabled="isLoading || assign.bookIds.length === 0 || selectedIds.length === 0"
              @click="addSelectedToBook"
            >
              加入（{{ selectedIds.length }}）
            </button>
            <button type="button" class="library-header__action library-header__action--ghost" :disabled="isLoading" @click="promptCreateBook">
              新建词书
            </button>
          </div>
        </label>

        <label class="library-header__field">
          <span>批量删除</span>
          <button
            type="button"
            class="library-header__action library-header__action--danger"
            :disabled="isLoading || selectedIds.length === 0"
            @click="deleteSelectedFromLibrary"
          >
            删除（{{ selectedIds.length }}）
          </button>
        </label>

        <label class="library-header__field">
          <span>词书</span>
          <select v-model="filters.bookName" class="library-header__select" :disabled="isLoading">
            <option value="">全部</option>
            <option v-for="item in bookNameOptions" :key="item" :value="item">{{ item }}</option>
          </select>
        </label>

        <label class="library-header__field">
          <span>来源</span>
          <select v-model="filters.sourceName" class="library-header__select" :disabled="isLoading">
            <option value="">全部</option>
            <option v-for="item in sourceNameOptions" :key="item" :value="item">{{ formatSourceName(item) }}</option>
          </select>
        </label>

        <label class="library-header__field">
          <span>搜索</span>
          <input
            v-model.trim="filters.query"
            class="library-header__input"
            placeholder="标准词 / 原词 / 释义"
            :disabled="isLoading"
            @keydown.enter="applyFilters"
          />
        </label>

        <button type="button" class="library-header__action" :disabled="isLoading" @click="applyFilters">
          {{ isLoading ? '加载中…' : '查询' }}
        </button>
      </div>
    </template>

    <div class="library-panel">
      <div class="library-panel__meta">
        <p class="library-panel__hint">
          共 {{ pagination.total }} 条，当前第 {{ pagination.page }} / {{ pageCount }} 页
        </p>
        <p v-if="errorMessage" class="library-panel__error">{{ errorMessage }}</p>
      </div>

      <div class="library-table">
        <div class="library-table__head">
          <span></span>
          <span>标准词</span>
          <span>原词</span>
          <span>词性</span>
          <span>释义</span>
          <span>操作</span>
        </div>

        <div v-if="items.length === 0" class="library-table__empty">
          暂无数据
        </div>

        <div v-for="item in items" :key="item.id" class="library-table__row">
          <div class="library-table__cell">
            <input
              type="checkbox"
              :checked="selectedSet.has(String(item.id))"
              :disabled="isLoading"
              @change="toggleSelect(item)"
            />
          </div>
          <div class="library-table__cell library-table__cell--strong">
            {{ item.lemma }}
            <span v-if="Array.isArray(item.bookNames) && item.bookNames.length" class="library-table__tags">
              <span v-for="name in item.bookNames.slice(0, 3)" :key="name" class="library-table__badge">
                {{ name }}
              </span>
              <span v-if="item.bookNames.length > 3" class="library-table__badge library-table__badge--muted">
                +{{ item.bookNames.length - 3 }}
              </span>
            </span>
          </div>
          <div class="library-table__cell">{{ item.rawWord || '-' }}</div>
          <div class="library-table__cell">{{ item.pos || '-' }}</div>
          <div class="library-table__cell library-table__cell--wrap">
            <p class="library-table__definition">{{ item.definition || '-' }}</p>
            <p v-if="item.exampleSentence" class="library-table__example">
              {{ item.exampleSentence }}
            </p>
          </div>
          <div class="library-table__cell library-table__cell--actions">
            <button type="button" class="library-table__btn" :disabled="isLoading" @click="openEditor(item)">
              编辑
            </button>
            <button type="button" class="library-table__btn library-table__btn--danger" :disabled="isLoading" @click="confirmDelete(item)">
              删除
            </button>
          </div>
        </div>
      </div>

      <div class="library-pagination">
        <button type="button" class="library-pagination__btn" :disabled="isLoading || pagination.page <= 1" @click="goPage(pagination.page - 1)">
          上一页
        </button>

        <div class="library-pagination__center">
          <label class="library-pagination__field">
            <span>页码</span>
            <input v-model.number="pageInput" class="library-pagination__input" type="number" min="1" :max="pageCount" :disabled="isLoading" />
          </label>
          <button type="button" class="library-pagination__btn" :disabled="isLoading" @click="goPage(pageInput)">
            跳转
          </button>

          <label class="library-pagination__field">
            <span>每页数量</span>
            <select v-model.number="pagination.pageSize" class="library-pagination__select" :disabled="isLoading" @change="applyPageSize">
              <option :value="20">20</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
            </select>
          </label>
        </div>

        <button
          type="button"
          class="library-pagination__btn"
          :disabled="isLoading || pagination.page >= pageCount"
          @click="goPage(pagination.page + 1)"
        >
          下一页
        </button>
      </div>
    </div>

    <div v-if="editor.open" class="modal" @click.self="closeEditor">
      <div class="modal__panel">
        <header class="modal__header">
          <div>
            <p class="modal__eyebrow">编辑词条</p>
            <h3 class="modal__title">{{ editor.item?.lemma }}</h3>
          </div>
          <button type="button" class="modal__close" :disabled="editor.saving" @click="closeEditor">×</button>
        </header>

        <div class="modal__body">
          <label class="modal__field">
            <span>释义</span>
            <textarea v-model="editor.definition" class="modal__textarea" rows="4" :disabled="editor.saving" />
          </label>
          <label class="modal__field">
            <span>例句</span>
            <textarea v-model="editor.exampleSentence" class="modal__textarea" rows="4" :disabled="editor.saving" />
          </label>
          <p v-if="editor.error" class="modal__error">{{ editor.error }}</p>
        </div>

        <footer class="modal__footer">
          <button type="button" class="modal__btn modal__btn--ghost" :disabled="editor.saving" @click="closeEditor">
            取消
          </button>
          <button type="button" class="modal__btn" :disabled="editor.saving" @click="saveEditor">
            {{ editor.saving ? '保存中…' : '保存' }}
          </button>
        </footer>
      </div>
    </div>
  </SectionCard>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import SectionCard from '@/components/common/SectionCard.vue'
import { libraryService } from '@/services/library.service.js'
import { booksService } from '@/services/books.service.js'

const isLoading = ref(false)
const errorMessage = ref('')
const items = ref([])
const books = ref([])
const allBooks = ref([])
const selectedSet = ref(new Set())

const filters = reactive({
  bookName: '',
  sourceName: '',
  query: ''
})

const assign = reactive({
  bookIds: []
})

const pagination = reactive({
  page: 1,
  pageSize: 50,
  total: 0
})

const pageInput = ref(1)

const editor = reactive({
  open: false,
  saving: false,
  error: '',
  item: null,
  definition: '',
  exampleSentence: ''
})

const bookNameOptions = computed(() => {
  return allBooks.value.map((b) => b.name).sort((a, b) => String(a).localeCompare(String(b)))
})

const sourceNameOptions = computed(() => {
  const set = new Set()
  books.value.forEach((item) => {
    if (item.sourceName) {
      set.add(item.sourceName)
    }
  })
  return [...set.values()].sort((a, b) => a.localeCompare(b))
})

const pageCount = computed(() => {
  const count = Math.ceil(Number(pagination.total || 0) / Number(pagination.pageSize || 1))
  return Math.max(1, count)
})

async function refreshBooks() {
  try {
    const payload = await libraryService.getOptions()
    books.value = Array.isArray(payload?.sources) ? payload.sources : []
    allBooks.value = Array.isArray(payload?.books) ? payload.books : []
    return
  } catch {
    const [legacy, modern] = await Promise.all([libraryService.listBooks(), booksService.listBooks()])
    books.value = Array.isArray(legacy?.items) ? legacy.items : []
    allBooks.value = Array.isArray(modern?.items) ? modern.items : []
  }
}

async function refreshEntries() {
  const payload = await libraryService.listEntries({
    page: pagination.page,
    pageSize: pagination.pageSize,
    bookName: filters.bookName,
    sourceName: filters.sourceName,
    query: filters.query
  })

  items.value = Array.isArray(payload?.items) ? payload.items : []
  pagination.total = Number(payload?.pagination?.total || 0)
  pagination.page = Number(payload?.pagination?.page || pagination.page)
  pagination.pageSize = Number(payload?.pagination?.pageSize || pagination.pageSize)
  pageInput.value = pagination.page
}

async function load() {
  isLoading.value = true
  errorMessage.value = ''
  try {
    await Promise.all([refreshBooks(), refreshEntries()])
  } catch (error) {
    errorMessage.value = error?.message || '加载失败'
  } finally {
    isLoading.value = false
  }
}

function applyFilters() {
  pagination.page = 1
  pageInput.value = 1
  selectedSet.value = new Set()
  load()
}

function applyPageSize() {
  pagination.page = 1
  pageInput.value = 1
  selectedSet.value = new Set()
  load()
}

function formatSourceName(value) {
  const sourceName = String(value || '').trim()
  if (!sourceName || sourceName === 'manual-input') return '手动输入'
  if (sourceName === 'library-add') return '从词库加入'
  return sourceName
}

function goPage(page) {
  const next = Number(page || 1)
  const safe = Math.min(Math.max(1, next), pageCount.value)
  pagination.page = safe
  pageInput.value = safe
  selectedSet.value = new Set()
  load()
}

const selectedIds = computed(() => {
  return Array.from(selectedSet.value.values())
})

function toggleSelect(item) {
  const id = String(item?.id || '')
  if (!id) return
  const next = new Set(selectedSet.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  selectedSet.value = next
}

async function promptCreateBook() {
  const name = window.prompt('请输入新词书名称：', '未命名词书')
  const trimmed = String(name || '').trim()
  if (!trimmed) return
  isLoading.value = true
  errorMessage.value = ''
  try {
    await booksService.createBook({ name: trimmed })
    await refreshBooks()
  } catch (error) {
    errorMessage.value = error?.message || '创建词书失败'
  } finally {
    isLoading.value = false
  }
}

async function addSelectedToBook() {
  if (!Array.isArray(assign.bookIds) || assign.bookIds.length === 0) return
  const wordIds = selectedIds.value.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
  if (!wordIds.length) return

  isLoading.value = true
  errorMessage.value = ''
  try {
    const bookIds = assign.bookIds.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
    if (bookIds.length === 1) {
      await booksService.addWordsToBook(bookIds[0], { wordIds, sourceName: 'library-add' })
    } else {
      try {
        await booksService.addWordsToBooks({ bookIds, wordIds, sourceName: 'library-add' })
      } catch (error) {
        const msg = String(error?.message || '')
        if (!msg.includes('接口不存在')) {
          throw error
        }
        for (const bookId of bookIds) {
          await booksService.addWordsToBook(bookId, { wordIds, sourceName: 'library-add' })
        }
      }
    }
    selectedSet.value = new Set()
    await load()
  } catch (error) {
    errorMessage.value = error?.message || '加入词书失败'
  } finally {
    isLoading.value = false
  }
}

async function deleteSelectedFromLibrary() {
  const wordIds = selectedIds.value.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
  if (!wordIds.length) return

  const ok = window.confirm(`确认从总词库批量删除 ${wordIds.length} 个单词？（会同时从所有词书移除）`)
  if (!ok) return

  isLoading.value = true
  errorMessage.value = ''
  try {
    await libraryService.deleteEntriesBatch({ ids: wordIds })
    selectedSet.value = new Set()
    await load()
  } catch (error) {
    errorMessage.value = error?.message || '批量删除失败'
  } finally {
    isLoading.value = false
  }
}

function openEditor(item) {
  editor.item = item
  editor.definition = item?.definition || ''
  editor.exampleSentence = item?.exampleSentence || ''
  editor.error = ''
  editor.open = true
}

function closeEditor(force = false) {
  if (!force && editor.saving) {
    return
  }
  editor.open = false
  editor.item = null
  editor.definition = ''
  editor.exampleSentence = ''
  editor.error = ''
}

async function saveEditor() {
  if (!editor.item?.id) {
    editor.error = '缺少 id'
    return
  }
  editor.saving = true
  editor.error = ''
  try {
    await libraryService.updateEntry(editor.item.id, {
      definition: editor.definition,
      exampleSentence: editor.exampleSentence
    })
    closeEditor(true)
    await load()
  } catch (error) {
    editor.error = error?.message || '保存失败'
  } finally {
    editor.saving = false
  }
}

async function confirmDelete(item) {
  if (!item?.id) {
    return
  }
  const ok = window.confirm(`确认删除词条：${item.lemma}？`)
  if (!ok) {
    return
  }

  isLoading.value = true
  errorMessage.value = ''
  try {
    await libraryService.deleteEntry(item.id)
    const remaining = pagination.total - 1
    const lastPage = Math.max(1, Math.ceil(Math.max(0, remaining) / pagination.pageSize))
    if (pagination.page > lastPage) {
      pagination.page = lastPage
    }
    await load()
  } catch (error) {
    errorMessage.value = error?.message || '删除失败'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  load()
})
</script>

<style scoped>
.library-header {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
  align-items: end;
}

.library-header__field {
  display: grid;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.library-header__input,
.library-header__select {
  min-width: 160px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  color: var(--color-text);
}

.library-header__action {
  padding: 10px 16px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: var(--color-primary);
  color: #fffaf2;
  cursor: pointer;
}

.library-header__action--ghost {
  background: transparent;
  border-color: var(--color-border);
  color: var(--color-text);
}

.library-header__action--danger {
  background: transparent;
  border-color: rgba(138, 47, 47, 0.34);
  color: #8a2f2f;
}

.library-header__assign {
  display: flex;
  gap: 8px;
  align-items: center;
}

.library-header__action:disabled {
  background: #c6b8aa;
  cursor: not-allowed;
}

.library-panel {
  display: grid;
  gap: 16px;
}

.library-panel__meta {
  display: grid;
  gap: 8px;
}

.library-panel__hint {
  margin: 0;
  color: var(--color-text-muted);
}

.library-panel__error {
  margin: 0;
  color: #8a2f2f;
  font-size: 0.92rem;
}

.library-table {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-strong);
  overflow: hidden;
}

.library-table__head,
.library-table__row {
  display: grid;
  grid-template-columns: 36px 160px 120px 90px minmax(0, 1fr) 140px;
  gap: 12px;
  padding: 14px 16px;
  align-items: start;
}

.library-table__head {
  background: rgba(138, 90, 50, 0.08);
  font-size: 0.85rem;
  color: var(--color-text-muted);
  font-weight: 600;
}

.library-table__row {
  border-top: 1px solid var(--color-border);
}

.library-table__cell {
  min-width: 0;
  font-size: 0.95rem;
}

.library-table__cell--strong {
  font-weight: 700;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.library-table__badge {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.74rem;
  color: var(--color-primary);
  background: rgba(138, 90, 50, 0.12);
  border: 1px solid rgba(138, 90, 50, 0.18);
}

.library-table__badge--muted {
  color: var(--color-text-muted);
  background: rgba(0, 0, 0, 0.04);
  border-color: rgba(0, 0, 0, 0.08);
}

.library-table__cell--wrap {
  display: grid;
  gap: 6px;
}

.library-table__definition,
.library-table__example {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.library-table__example {
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.library-table__cell--actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.library-table__btn {
  padding: 9px 12px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
}

.library-table__btn--danger {
  border-color: rgba(138, 47, 47, 0.28);
  color: #8a2f2f;
}

.library-table__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.library-table__empty {
  padding: 18px 16px;
  color: var(--color-text-muted);
}

.library-pagination {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.library-pagination__center {
  display: flex;
  gap: 10px;
  align-items: end;
  flex-wrap: wrap;
}

.library-pagination__btn {
  padding: 10px 14px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.6);
  cursor: pointer;
}

.library-pagination__btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.library-pagination__field {
  display: grid;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.library-pagination__input,
.library-pagination__select {
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  color: var(--color-text);
  min-width: 120px;
}

.modal {
  position: fixed;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 18px;
  background: rgba(47, 36, 29, 0.35);
  z-index: 50;
}

.modal__panel {
  width: min(720px, 100%);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-bg-strong);
  box-shadow: var(--color-shadow);
}

.modal__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: start;
  padding: 18px 18px 0;
}

.modal__eyebrow {
  margin: 0 0 6px;
  color: var(--color-primary);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.modal__title {
  margin: 0;
  font-size: 1.15rem;
}

.modal__close {
  width: 40px;
  height: 40px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: transparent;
  cursor: pointer;
  font-size: 1.2rem;
  line-height: 1;
}

.modal__body {
  padding: 16px 18px 0;
  display: grid;
  gap: 14px;
}

.modal__field {
  display: grid;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.modal__textarea {
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.85);
  resize: vertical;
}

.modal__error {
  margin: 0;
  color: #8a2f2f;
}

.modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 18px;
}

.modal__btn {
  padding: 12px 18px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: var(--color-primary);
  color: #fffaf2;
  cursor: pointer;
}

.modal__btn--ghost {
  border-color: var(--color-border);
  background: transparent;
  color: var(--color-text);
}

.modal__btn:disabled,
.modal__close:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 960px) {
  .library-table__head,
  .library-table__row {
    grid-template-columns: 140px 100px 70px minmax(0, 1fr) 120px;
  }

  .library-header {
    justify-content: flex-start;
  }
}

@media (max-width: 720px) {
  .library-table__head {
    display: none;
  }

  .library-table__row {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .library-table__cell--actions {
    justify-content: flex-start;
  }
}
</style>
