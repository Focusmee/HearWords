import { http } from '@/services/http.js'

export const booksService = {
  listBooks() {
    return http.get('/api/books')
  },
  createBook({ name }) {
    return http.post('/api/books', { name })
  },
  addWordsToBook(bookId, { wordIds, sourceName } = {}) {
    return http.post(`/api/books/${encodeURIComponent(bookId)}/words`, { wordIds, sourceName })
  },
  removeWordsFromBook(bookId, { wordIds } = {}) {
    return http.delete(`/api/books/${encodeURIComponent(bookId)}/words`, { wordIds })
  }
}

