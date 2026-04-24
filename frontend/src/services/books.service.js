import { http } from '@/services/http.js'

export const booksService = {
  listBooks() {
    return http.get('/api/books')
  },
  createBook({ name }) {
    return http.post('/api/books', { name })
  },
  deleteBook(bookId) {
    return http.delete(`/api/books/${encodeURIComponent(bookId)}`)
  },
  addWordsToBook(bookId, { wordIds, sourceName } = {}) {
    return http.post(`/api/books/${encodeURIComponent(bookId)}/words`, { wordIds, sourceName })
  },
  addWordsToBooks({ bookIds, wordIds, sourceName } = {}) {
    return http.post('/api/books/batch/words', { bookIds, wordIds, sourceName })
  },
  removeWordsFromBook(bookId, { wordIds } = {}) {
    return http.delete(`/api/books/${encodeURIComponent(bookId)}/words`, { wordIds })
  }
}
