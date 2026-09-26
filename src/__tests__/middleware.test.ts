import { beforeEach, describe, expect, test, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { getRateLimitKey } from '@/lib/rate-limit'

const { getToken } = vi.hoisted(() => ({
  getToken: vi.fn(),
}))

vi.mock('next-auth/jwt', () => ({
  getToken,
}))

import { config, middleware } from '../../middleware'

describe('admin middleware', () => {
  const originalNextAuthSecret = process.env.NEXTAUTH_SECRET
  const originalAuthSecret = process.env.AUTH_SECRET

  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    process.env.NEXTAUTH_SECRET = originalNextAuthSecret
    process.env.AUTH_SECRET = originalAuthSecret
    vi.stubEnv('NODE_ENV', 'test')
    delete process.env.OPERATION_LOG_INGEST_SECRET
  })

  test('falls back to AUTH_SECRET when NEXTAUTH_SECRET is absent', async () => {
    process.env.NEXTAUTH_SECRET = ''
    process.env.AUTH_SECRET = 'auth-secret'
    getToken.mockResolvedValueOnce(null)

    const request = new NextRequest('http://localhost/admin')
    await middleware(request)

    expect(getToken).toHaveBeenCalledWith(
      expect.objectContaining({
        req: request,
        secret: 'auth-secret',
        cookieName: 'next-auth.session-token',
      }),
    )
  })

  test('falls back to AUTH_SECRET when NEXTAUTH_SECRET is a placeholder', async () => {
    process.env.NEXTAUTH_SECRET = 'replace-with-a-long-random-secret'
    process.env.AUTH_SECRET = 'auth-secret'
    getToken.mockResolvedValueOnce(null)

    const request = new NextRequest('http://localhost/admin')
    await middleware(request)

    expect(getToken).toHaveBeenCalledWith(
      expect.objectContaining({
        req: request,
        secret: 'auth-secret',
        cookieName: 'next-auth.session-token',
      }),
    )
  })

  test('returns an explicit server error for admin APIs when production auth secret is missing', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    process.env.NEXTAUTH_SECRET = 'replace-with-a-long-random-secret'
    process.env.AUTH_SECRET = ''

    const request = new NextRequest('http://localhost/api/admin/posts')
    const response = await middleware(request)
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload).toEqual({ error: 'Authentication secret is not configured' })
    expect(getToken).not.toHaveBeenCalled()
  })

  test('redirects unauthenticated users from /admin to the login dialog with callbackUrl', async () => {
    getToken.mockResolvedValueOnce(null)

    const request = new NextRequest('http://localhost/admin')
    const response = await middleware(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/?login=1&callbackUrl=%2Fadmin')
  })

  test('redirects non-admin users from /admin to the login dialog with error marker', async () => {
    getToken.mockResolvedValueOnce({ role: 'USER' })

    const request = new NextRequest('http://localhost/admin/posts')
    const response = await middleware(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/?login=1&error=not-admin&callbackUrl=%2Fadmin%2Fposts')
  })

  test('allows admin users to access /admin', async () => {
    getToken.mockResolvedValueOnce({ role: 'ADMIN' })

    const request = new NextRequest('http://localhost/admin')
    const response = await middleware(request)

    expect(response.status).toBe(200)
  })

  test('returns json 401 for unauthenticated admin api requests', async () => {
    getToken.mockResolvedValueOnce(null)

    const request = new NextRequest('http://localhost/api/admin/posts')
    const response = await middleware(request)
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({ error: 'Unauthorized' })
  })

  test('records denied admin api requests through waitUntil', async () => {
    process.env.NEXTAUTH_SECRET = 'auth-secret'
    getToken.mockResolvedValueOnce(null)
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })))
    vi.stubGlobal('fetch', fetchMock)
    const waitUntil = vi.fn((promise: Promise<unknown>) => promise)

    const request = new NextRequest('http://localhost/api/admin/posts?preview=delete', {
      headers: { 'x-forwarded-for': '203.0.113.10' },
    })
    const response = await middleware(request, { waitUntil } as never)
    const pendingLog = waitUntil.mock.calls[0]?.[0] as Promise<unknown>
    await pendingLog
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)

    expect(response.status).toBe(401)
    expect(response.headers.get('x-request-id')).toBe(body.requestId)
    expect(fetchMock).toHaveBeenCalledWith(new URL('/api/internal/operation-logs', request.url), expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        // 非生产环境使用专用 dev 回退密钥；不再复用 AUTH_SECRET。
        'x-operation-log-ingest-secret': 'development-operation-log-ingest',
      }),
    }))
    expect(body).toEqual(expect.objectContaining({
      method: 'GET',
      path: '/api/admin/posts',
      query: '?preview=delete',
      scope: 'admin',
      operation: 'middleware.adminApiDenied',
      statusCode: 401,
      errorMessage: 'Unauthorized',
      ip: '203.0.113.10',
    }))
  })

  test('skips denied-log recording in production without a dedicated ingest secret', async () => {
    process.env.NEXTAUTH_SECRET = 'auth-secret'
    vi.stubEnv('NODE_ENV', 'production')
    delete process.env.OPERATION_LOG_INGEST_SECRET
    getToken.mockResolvedValueOnce(null)
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })))
    vi.stubGlobal('fetch', fetchMock)
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const waitUntil = vi.fn((promise: Promise<unknown>) => promise)

    const request = new NextRequest('http://localhost/api/admin/posts')
    const response = await middleware(request, { waitUntil } as never)

    expect(response.status).toBe(401)
    expect(waitUntil).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
    // lib 层 fail-loud：生产缺配时发出一次告警，避免审计日志静默丢失。
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('OPERATION_LOG_INGEST_SECRET is not configured'),
    )
    errorSpy.mockRestore()
  })

  test('returns json 403 for non-admin admin api requests', async () => {
    getToken.mockResolvedValueOnce({ role: 'USER' })

    const request = new NextRequest('http://localhost/api/admin/posts')
    const response = await middleware(request)
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload).toEqual({ error: 'Forbidden' })
  })
})

describe('rate limit key contract', () => {
  test('prefixes actor identifiers with the scope', () => {
    const request = new Request('http://localhost/api/search', {
      headers: {
        'x-forwarded-for': '203.0.113.10, 10.0.0.2',
      },
    })

    expect(getRateLimitKey(request, 'auth')).toBe('auth:203.0.113.10')
    expect(getRateLimitKey(request, 'interaction')).toBe('interaction:203.0.113.10')
  })

  test('falls back to an anonymous actor marker when no network identifier is present', () => {
    const request = new Request('http://localhost/api/search')

    expect(getRateLimitKey(request, 'upload')).toBe('upload:anonymous')
  })
})

describe('internal api middleware gateway', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    vi.stubEnv('NODE_ENV', 'test')
    delete process.env.OPERATION_LOG_INGEST_SECRET
    delete process.env.AI_NEWS_CRON_SECRET
    delete process.env.PUBLISH_SCHEDULED_CRON_SECRET
    delete process.env.CRON_SECRET
  })

  test('matcher covers cron and internal api prefixes', () => {
    expect(config.matcher).toEqual(
      expect.arrayContaining(['/api/cron/:path*', '/api/internal/:path*']),
    )
  })

  test('log retention registers only its exact path and CRON_SECRET', async () => {
    process.env.AI_NEWS_CRON_SECRET = 'unrelated-secret'
    const request = (path: string, token: string) => new NextRequest('http://localhost' + path, { headers: { authorization: 'Bearer ' + token, 'x-forwarded-for': '203.0.113.181' } })
    expect((await middleware(request('/api/cron/log-retention', 'unrelated-secret'))).status).toBe(503)
    process.env.CRON_SECRET = 'retention-secret'
    expect((await middleware(request('/api/cron/log-retention', 'unrelated-secret'))).status).toBe(401)
    expect((await middleware(request('/api/cron/log-retention', 'retention-secret'))).status).toBe(200)
    expect((await middleware(request('/api/cron/log-retention-extra', 'retention-secret'))).status).toBe(503)
  })

  test('log retention limits repeated wrong-secret attempts', async () => {
    process.env.CRON_SECRET = 'retention-secret'
    for (let attempt = 1; attempt <= 11; attempt++) {
      const response = await middleware(new NextRequest('http://localhost/api/cron/log-retention', { headers: { authorization: 'Bearer wrong', 'x-forwarded-for': '203.0.113.182' } }))
      expect(response.status).toBe(attempt <= 10 ? 401 : 429)
    }
  })

  test('rejects cron requests without a valid bearer secret', async () => {
    process.env.AI_NEWS_CRON_SECRET = 'cron-secret'

    const request = new NextRequest('http://localhost/api/cron/ai-news', {
      headers: { authorization: 'Bearer wrong', 'x-forwarded-for': '203.0.113.11' },
    })
    const response = await middleware(request)
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({ error: 'Unauthorized' })
    expect(response.headers.get('x-request-id')).toBeTruthy()
    expect(getToken).not.toHaveBeenCalled()
  })

  test('allows cron requests with the correct bearer secret', async () => {
    process.env.AI_NEWS_CRON_SECRET = 'cron-secret'

    const request = new NextRequest('http://localhost/api/cron/ai-news', {
      headers: { authorization: 'Bearer cron-secret' },
    })
    const response = await middleware(request)

    expect(response.status).toBe(200)
    expect(getToken).not.toHaveBeenCalled()
  })

  test('fails closed with 503 when a cron secret is not configured', async () => {
    const request = new NextRequest('http://localhost/api/cron/ai-news', {
      headers: { authorization: 'Bearer anything' },
    })
    const response = await middleware(request)
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload).toEqual({ error: 'Internal service secret is not configured' })
  })

  test('fails closed with 503 for unregistered cron prefixes', async () => {
    process.env.AI_NEWS_CRON_SECRET = 'cron-secret'

    const request = new NextRequest('http://localhost/api/cron/unknown-endpoint', {
      headers: { authorization: 'Bearer cron-secret' },
    })
    const response = await middleware(request)
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload).toEqual({ error: 'Internal endpoint is not registered' })
  })

  test('does not treat a registered path prefix collision as an exact registration', async () => {
    process.env.AI_NEWS_CRON_SECRET = 'cron-secret'

    const request = new NextRequest('http://localhost/api/cron/ai-news-extra', {
      headers: { authorization: 'Bearer cron-secret' },
    })
    const response = await middleware(request)
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload).toEqual({ error: 'Internal endpoint is not registered' })
  })

  test('records denied cron attempts through waitUntil', async () => {
    process.env.AI_NEWS_CRON_SECRET = 'cron-secret'
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })))
    vi.stubGlobal('fetch', fetchMock)
    const waitUntil = vi.fn((promise: Promise<unknown>) => promise)

    const request = new NextRequest('http://localhost/api/cron/publish-scheduled', {
      headers: { authorization: 'Bearer wrong', 'x-forwarded-for': '203.0.113.12' },
    })
    const response = await middleware(request, { waitUntil } as never)
    const pendingLog = waitUntil.mock.calls[0]?.[0] as Promise<unknown>
    await pendingLog
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)

    expect(response.status).toBe(401)
    expect(body).toEqual(expect.objectContaining({
      path: '/api/cron/publish-scheduled',
      scope: 'cron',
      operation: 'middleware.cronApiDenied',
      statusCode: 401,
    }))
  })

  test('does not write back logs when internal ingest requests are denied (no self-loop)', async () => {
    process.env.OPERATION_LOG_INGEST_SECRET = 'ingest-secret'
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })))
    vi.stubGlobal('fetch', fetchMock)
    const waitUntil = vi.fn((promise: Promise<unknown>) => promise)

    const request = new NextRequest('http://localhost/api/internal/operation-logs', {
      method: 'POST',
      headers: { 'x-operation-log-ingest-secret': 'wrong', 'x-forwarded-for': '203.0.113.13' },
    })
    const response = await middleware(request, { waitUntil } as never)
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({ error: 'Unauthorized' })
    expect(waitUntil).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  test('allows internal ingest requests with the correct secret', async () => {
    process.env.OPERATION_LOG_INGEST_SECRET = 'ingest-secret'

    const request = new NextRequest('http://localhost/api/internal/operation-logs', {
      method: 'POST',
      headers: { 'x-operation-log-ingest-secret': 'ingest-secret' },
    })
    const response = await middleware(request)

    expect(response.status).toBe(200)
  })

  test('lets internal ingest through to the handler when production secret is missing (handler returns 503)', async () => {
    vi.stubEnv('NODE_ENV', 'production')

    const request = new NextRequest('http://localhost/api/internal/operation-logs', {
      method: 'POST',
      headers: { 'x-operation-log-ingest-secret': 'anything' },
    })
    const response = await middleware(request)

    expect(response.status).toBe(200)
  })

  test('throttles repeated failed internal attempts with 429', async () => {
    process.env.AI_NEWS_CRON_SECRET = 'cron-secret'

    let lastStatus = 0
    for (let attempt = 1; attempt <= 11; attempt++) {
      const request = new NextRequest('http://localhost/api/cron/ai-news', {
        headers: { authorization: 'Bearer wrong', 'x-forwarded-for': '203.0.113.99' },
      })
      const response = await middleware(request)
      lastStatus = response.status

      if (attempt <= 10) {
        expect(response.status).toBe(401)
      }
    }

    expect(lastStatus).toBe(429)
  })
})
