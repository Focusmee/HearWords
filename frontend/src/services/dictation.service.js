import { http } from '@/services/http.js'

export const dictationService = {
  startSession({ scope }) {
    return http.post('/api/dictation/start', { scope })
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

