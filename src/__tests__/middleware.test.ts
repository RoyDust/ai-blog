import { beforeEach, describe, expect, test, vi } from 'vitest'
import { NextRequest } from 'next/server'

import { getRateLimitKey } from '@/lib/rate-limit'

const { getToken } = vi.hoisted(() => ({
  getToken: vi.fn(),
}))

vi.mock('next-auth/jwt', () => ({
  getToken,
}))

import { middleware } from '../../middleware'

describe('admin middleware', () => {
  const originalNextAuthSecret = process.env.NEXTAUTH_SECRET
  const originalAuthSecret = process.env.AUTH_SECRET

  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    process.env.NEXTAUTH_SECRET = originalNextAuthSecret
    process.env.AUTH_SECRET = originalAuthSecret
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

  test('redirects unauthenticated users from /admin to /login with callbackUrl', async () => {
    getToken.mockResolvedValueOnce(null)

    const request = new NextRequest('http://localhost/admin')
    const response = await middleware(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/login?callbackUrl=%2Fadmin')
  })

  test('redirects non-admin users from /admin to /login with error marker', async () => {
    getToken.mockResolvedValueOnce({ role: 'USER' })

    const request = new NextRequest('http://localhost/admin/posts')
    const response = await middleware(request)

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('http://localhost/login?error=not-admin&callbackUrl=%2Fadmin%2Fposts')
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
