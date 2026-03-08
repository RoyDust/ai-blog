const BROWSER_ID_STORAGE_KEY = 'anonymous-browser-id'

function createBrowserId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `anon_${crypto.randomUUID()}`
  }

  return `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

export function getOrCreateBrowserId() {
  if (typeof window === 'undefined') {
    return createBrowserId()
  }

  const existing = window.localStorage.getItem(BROWSER_ID_STORAGE_KEY)
  if (existing) {
    return existing
  }

  const browserId = createBrowserId()
  window.localStorage.setItem(BROWSER_ID_STORAGE_KEY, browserId)
  return browserId
}

export function getBrowserIdFromHeaders(headers: Headers) {
  const browserId = headers.get('x-browser-id')?.trim()
  return browserId ? browserId : null
}

export function maskIpAddress(ipAddress: string | null | undefined) {
  if (!ipAddress) {
    return '匿名访客'
  }

  const normalized = ipAddress.trim()
  if (!normalized) {
    return '匿名访客'
  }

  if (normalized.includes('.')) {
    const parts = normalized.split('.')
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.*.*`
    }
  }

  if (normalized.includes(':')) {
    const parts = normalized.split(':').filter(Boolean)
    if (parts.length >= 2) {
      const first = Number.parseInt(parts[0]!, 16).toString(16)
      const second = Number.parseInt(parts[1]!, 16).toString(16)
      return `${first}:${second}:*:*`
    }
  }

  return '匿名访客'
}

export { BROWSER_ID_STORAGE_KEY }
