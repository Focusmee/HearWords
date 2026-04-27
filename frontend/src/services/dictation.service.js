import { http } from '@/services/http.js'

export const dictationService = {
  startSession({ includedBookNames, bookNames, wordIds, scope, taskItems } = {}) {
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
    if (Array.isArray(taskItems) && taskItems.length) {
      payload.taskItems = taskItems
    }
    return http.post('/api/dictation/start', payload)
  },
  getTodayTask({ intensity = 'standard', bookName = '' } = {}) {
    const params = new URLSearchParams()
    if (intensity) params.set('intensity', intensity)
    if (bookName) params.set('bookName', bookName)
    const query = params.toString()
    return http.get(`/api/review/today-task${query ? `?${query}` : ''}`)
  },
  getSession() {
    return http.get('/api/dictation/session')
  },
  resetSession() {
    return http.delete('/api/dictation/session')
  },
  checkAnswer({ answer, answerDurationMs }) {
    return http.post('/api/dictation/check', { answer, answerDurationMs })
  },
  skipCurrent({ answerDurationMs } = {}) {
    return http.post('/api/dictation/skip', { answerDurationMs })
  }
}
