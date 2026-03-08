import { beforeEach, describe, expect, test, vi } from 'vitest'
import { NextRequest } from 'next/server'

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
})
