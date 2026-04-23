async function readResponsePayload(response) {
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json()
  }

  const text = await response.text()
  if (!text) {
    return null
  }
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function normalizeErrorMessage(payload, fallback) {
  if (!payload) {
    return fallback
  }
  if (typeof payload === 'string') {
    return payload
  }
  if (typeof payload === 'object') {
    if (typeof payload.error === 'string' && payload.error.trim()) {
      return payload.error.trim()
    }
    if (typeof payload.message === 'string' && payload.message.trim()) {
      return payload.message.trim()
    }
  }
  return fallback
}

async function request(path, { method = 'GET', body } = {}) {
  const baseUrl = (import.meta.env?.VITE_API_BASE || '').replace(/\/+$/, '')
  const requestUrl = path.startsWith('http') ? path : `${baseUrl}${path}`

  const response = await fetch(requestUrl, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  })

  const payload = await readResponsePayload(response)

  if (!response.ok) {
    throw new Error(normalizeErrorMessage(payload, `HTTP ${response.status}`))
  }

  if (payload && typeof payload === 'object') {
    if (payload.success === false) {
      throw new Error(normalizeErrorMessage(payload, '请求失败'))
    }
    if (typeof payload.error === 'string' && payload.error.trim()) {
      throw new Error(payload.error.trim())
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'data')) {
      return payload.data
    }
  }

  return payload
}

export const http = {
  get(path) {
    return request(path, { method: 'GET' })
  },
  post(path, body) {
    return request(path, { method: 'POST', body })
  },
  patch(path, body) {
    return request(path, { method: 'PATCH', body })
  },
  delete(path, body) {
    return request(path, { method: 'DELETE', body })
  }
}
