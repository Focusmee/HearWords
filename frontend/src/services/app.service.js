import { http } from '@/services/http.js'

export const appService = {
  getHealth() {
    return http.get('/api/health')
  }
}

