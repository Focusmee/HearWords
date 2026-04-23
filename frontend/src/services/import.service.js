import { http } from '@/services/http.js'

export const importService = {
  ocrImage({ imageBase64, filename }) {
    return http.post('/api/ocr', { imageBase64, filename })
  },
  extractDocument({ filename, fileBase64 }) {
    return http.post('/api/extract-document', { filename, fileBase64 })
  },
  parseText({ text, sourceName, mode, limit }) {
    return http.post('/api/parse', { text, sourceName, bookName: '', mode, limit })
  },
  importLibrary({ entries }) {
    return http.post('/api/library/import', { entries })
  }
}
