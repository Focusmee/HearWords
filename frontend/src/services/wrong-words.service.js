import { http } from '@/services/http.js'

export const wrongWordsService = {
  listWrongWords({ status } = {}) {
    const qs = status ? `?status=${encodeURIComponent(status)}` : ''
    return http.get(`/api/wrong-words${qs}`)
  },
  setImportant(wordId, important = true) {
    return http.patch(`/api/wrong-words/${encodeURIComponent(wordId)}/important`, { important })
  },
  markMastered(wordId) {
    return http.patch(`/api/wrong-words/${encodeURIComponent(wordId)}/mastered`, {})
  }
}
