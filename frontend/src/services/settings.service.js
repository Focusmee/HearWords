import { http } from '@/services/http.js'

export const settingsService = {
  getSettings() {
    return http.get('/api/settings')
  },
  saveSettings(payload) {
    return http.post('/api/settings', payload)
  }
}

