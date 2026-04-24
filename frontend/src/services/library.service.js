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
  getOptions() {
    return http.get('/api/library/options')
  },
  getLibrary({ bookName } = {}) {
    const qs = buildQuery({ bookName })
    return http.get(`/api/library${qs}`)
  },
  listBooks() {
    return http.get('/api/library/books')
  },
  listEntries({ page, pageSize, bookName, sourceName, query } = {}) {
    const qs = buildQuery({ page, pageSize, bookName, sourceName, query })
    return http.get(`/api/library/entries${qs}`)
  },
  deleteEntriesBatch({ ids } = {}) {
    return http.post('/api/library/batch/delete', { ids })
  },
  updateEntry(id, { definition, exampleSentence } = {}) {
    return http.patch(`/api/library/${encodeURIComponent(id)}`, { definition, exampleSentence })
  },
  deleteEntry(id) {
    return http.delete(`/api/library/${encodeURIComponent(id)}`)
  }
}
