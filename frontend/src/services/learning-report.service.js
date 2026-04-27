import { http } from '@/services/http.js'

export const learningReportService = {
  getReport() {
    return http.get('/api/learning-report')
  }
}
