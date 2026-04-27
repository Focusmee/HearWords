<template>
  <SectionCard title="词书" eyebrow="词书" description="词书作为独立实体；查看成员、移除成员、创建新词书。">
    <template #header-extra>
      <div class="books-header">
        <label class="books-header__field">
          <span>当前词书</span>
          <select v-model="selectedBookId" class="books-header__select" :disabled="isLoading">
            <option value="">请选择</option>
            <option v-for="book in books" :key="book.id" :value="String(book.id)">
              {{ book.name }}（{{ book.wordCount }}）
            </option>
          </select>
        </label>

        <button type="button" class="books-header__action books-header__action--ghost" :disabled="isLoading" @click="promptCreateBook">
          新建词书
        </button>
        <button
          type="button"
          class="books-header__action books-header__action--danger"
          :disabled="isLoading || !selectedBookId"
          @click="deleteSelectedBook"
        >
          删除词书
        </button>
        <button
          type="button"
          class="books-header__action books-header__action--danger"
          :disabled="isLoading || !selectedBookId || selectedWordIds.length === 0"
          @click="removeSelectedWords"
        >
          批量移除（{{ selectedWordIds.length }}）
        </button>
        <button type="button" class="books-header__action" :disabled="isLoading || !selectedBookId" @click="loadBookWords">
          {{ isLoading ? '加载中…' : '刷新' }}
        </button>
      </div>
    </template>

    <div class="books-panel">
      <p v-if="errorMessage" class="books-panel__error">{{ errorMessage }}</p>

      <div v-if="!selectedBookId" class="books-panel__empty">
        请选择一个词书查看成员
      </div>

      <div v-else class="books-table">
        <div class="books-table__head">
          <span></span>
          <span>标准词</span>
          <span>释义</span>
          <span>操作</span>
        </div>

        <div v-if="words.length === 0" class="books-table__empty">该词书暂无成员</div>

        <div v-for="word in words" :key="word.id" class="books-table__row">
          <div class="books-table__cell">
            <input
              type="checkbox"
              :checked="selectedSet.has(String(word.id))"
              :disabled="isLoading"
              @change="toggleSelect(word)"
            />
          </div>
          <div class="books-table__cell books-table__cell--strong">{{ word.lemma }}</div>
          <div class="books-table__cell books-table__cell--wrap">
            <p class="books-table__definition">{{ word.definition || '-' }}</p>
            <p v-if="word.exampleSentence" class="books-table__example">{{ word.exampleSentence }}</p>
          </div>
          <div class="books-table__cell books-table__cell--actions">
            <button type="button" class="books-table__btn books-table__btn--danger" :disabled="isLoading" @click="removeWord(word)">
              移除
            </button>
          </div>
        </div>
      </div>
    </div>
  </SectionCard>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import SectionCard from '@/components/common/SectionCard.vue'
import { booksService } from '@/services/books.service.js'
import { libraryService } from '@/services/library.service.js'

const isLoading = ref(false)
const errorMessage = ref('')
const books = ref([])
const selectedBookId = ref('')
const words = ref([])
const selectedSet = ref(new Set())

const selectedWordIds = computed(() => {
  return Array.from(selectedSet.value.values())
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0)
})

async function refreshBooks() {
  const payload = await booksService.listBooks()
  books.value = Array.isArray(payload?.items) ? payload.items : []
}

function getSelectedBookName() {
  const id = Number(selectedBookId.value)
  const found = books.value.find((book) => Number(book.id) === id)
  return found?.name || ''
}

async function loadBookWords() {
  errorMessage.value = ''
  const name = getSelectedBookName()
  if (!name) {
    words.value = []
    selectedSet.value = new Set()
    return
  }
  const payload = await libraryService.getLibrary({ bookName: name })
  words.value = Array.isArray(payload?.items) ? payload.items : []
  selectedSet.value = new Set()
}

function toggleSelect(word) {
  const id = String(word?.id || '')
  if (!id) return
  const next = new Set(selectedSet.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  selectedSet.value = next
}

async function removeSelectedWords() {
  if (!selectedBookId.value) return
  const wordIds = selectedWordIds.value
  if (!wordIds.length) return

  const ok = window.confirm(`确认从该词书批量移除 ${wordIds.length} 个单词？（不会从总词库删除）`)
  if (!ok) return

  isLoading.value = true
  errorMessage.value = ''
  try {
    await booksService.removeWordsFromBook(selectedBookId.value, { wordIds })
    selectedSet.value = new Set()
    await refreshBooks()
    await loadBookWords()
  } catch (error) {
    errorMessage.value = error?.message || '批量移除失败'
  } finally {
    isLoading.value = false
  }
}

async function deleteSelectedBook() {
  const bookId = selectedBookId.value
  if (!bookId) return

  const name = getSelectedBookName()
  const ok = window.confirm(`确认删除词书：${name || bookId}？（仅删除词书与关联，不会删除总词库单词）`)
  if (!ok) return

  isLoading.value = true
  errorMessage.value = ''
  try {
    await booksService.deleteBook(bookId)
    selectedBookId.value = ''
    words.value = []
    selectedSet.value = new Set()
    await refreshBooks()
  } catch (error) {
    errorMessage.value = error?.message || '删除词书失败'
  } finally {
    isLoading.value = false
  }
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

async function removeWord(word) {
  const wordId = Number(word?.id)
  if (!wordId) return
  const ok = window.confirm(`确认从词书移除：${word.lemma}？（不会从总词库删除）`)
  if (!ok) return

  isLoading.value = true
  errorMessage.value = ''
  try {
    await booksService.removeWordsFromBook(selectedBookId.value, { wordIds: [wordId] })
    await refreshBooks()
    await loadBookWords()
  } catch (error) {
    errorMessage.value = error?.message || '移除失败'
  } finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  isLoading.value = true
  try {
    await refreshBooks()
  } catch (error) {
    errorMessage.value = error?.message || '加载失败'
  } finally {
    isLoading.value = false
  }
})
</script>

<style scoped>
.books-header {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
  align-items: end;
}

.books-header__field {
  display: grid;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.books-header__select {
  min-width: 220px;
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  color: var(--color-text);
}

.books-header__action {
  padding: 10px 16px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: var(--color-primary);
  color: #fffaf2;
  cursor: pointer;
}

.books-header__action--ghost {
  background: transparent;
  border-color: var(--color-border);
  color: var(--color-text);
}

.books-header__action--danger {
  background: transparent;
  border-color: rgba(138, 47, 47, 0.34);
  color: #8a2f2f;
}

.books-header__action:disabled {
  background: #c6b8aa;
  cursor: not-allowed;
}

.books-panel {
  display: grid;
  gap: 16px;
}

.books-panel__error {
  margin: 0;
  color: #8a2f2f;
  font-size: 0.92rem;
}

.books-panel__empty {
  padding: 22px;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
  color: var(--color-text-muted);
  background: rgba(255, 255, 255, 0.7);
}

.books-table {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-strong);
  overflow: hidden;
}

.books-table__head,
.books-table__row {
  display: grid;
  grid-template-columns: 36px 160px minmax(0, 1fr) 110px;
  gap: 12px;
  padding: 14px 16px;
  align-items: start;
}

.books-table__head {
  background: rgba(138, 90, 50, 0.08);
  font-size: 0.85rem;
  color: var(--color-text-muted);
  font-weight: 600;
}

.books-table__row {
  border-top: 1px solid var(--color-border);
}

.books-table__empty {
  padding: 18px 16px;
  color: var(--color-text-muted);
}

.books-table__cell {
  min-width: 0;
  font-size: 0.95rem;
}

.books-table__cell--strong {
  font-weight: 700;
}

.books-table__cell--wrap {
  display: grid;
  gap: 6px;
}

.books-table__definition,
.books-table__example {
  margin: 0;
}

.books-table__definition {
  line-height: 1.25;
}

.books-table__example {
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.books-table__cell--actions {
  display: flex;
  justify-content: flex-end;
}

.books-table__btn {
  padding: 8px 12px;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: transparent;
  cursor: pointer;
}

.books-table__btn--danger {
  border-color: rgba(138, 47, 47, 0.4);
  color: #8a2f2f;
}
</style>
