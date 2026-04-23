import { http } from '@/services/http.js'

function buildQuery(params) {
  const searchParams = new URLSearchParams()
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return
    }
    const text = String(value).trim()
    if (!text) {
      return
    }
    searchParams.set(key, text)
  })

  const queryString = searchParams.toString()
  return queryString ? `?${queryString}` : ''
}

export const libraryService = {
  getLibrary() {
    return http.get('/api/library')
  },
  listBooks() {
    return http.get('/api/library/books')
  },
  listEntries({ page, pageSize, bookName, sourceName, query } = {}) {
    const qs = buildQuery({ page, pageSize, bookName, sourceName, query })
    return http.get(`/api/library/entries${qs}`)
  },
  updateEntry(id, { definition, exampleSentence } = {}) {
    return http.patch(`/api/library/${encodeURIComponent(id)}`, { definition, exampleSentence })
  },
  deleteEntry(id) {
    return http.delete(`/api/library/${encodeURIComponent(id)}`)
  }
}

