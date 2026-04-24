import { http } from '@/services/http.js'

export const dictationService = {
  startSession({ includedBookNames, bookNames, wordIds, scope } = {}) {
    const payload = {}
    const books = Array.isArray(includedBookNames) ? includedBookNames : bookNames
    if (Array.isArray(books) && books.length) {
      payload.includedBookNames = books
    }
    if (Array.isArray(wordIds) && wordIds.length) {
      payload.wordIds = wordIds
    }
    if (scope) {
      payload.scope = scope
    }
    return http.post('/api/dictation/start', payload)
  },
  getSession() {
    return http.get('/api/dictation/session')
  },
  resetSession() {
    return http.delete('/api/dictation/session')
  },
  checkAnswer({ answer }) {
    return http.post('/api/dictation/check', { answer })
  },
  skipCurrent() {
    return http.post('/api/dictation/skip')
  }
}
