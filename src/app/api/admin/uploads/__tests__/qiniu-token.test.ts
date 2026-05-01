import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(async () => ({ user: { id: 'admin-1', role: 'ADMIN' } })),
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

describe('qiniu token route', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    process.env.QINIU_ACCESS_KEY = 'test-ak'
    process.env.QINIU_SECRET_KEY = 'test-sk'
    process.env.QINIU_BUCKET = 'test-bucket'
    process.env.QINIU_DOMAIN = 'http://project.roydust.top'
    delete process.env.QINIU_UPLOAD_URL
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  test('returns upload token payload for valid filename', async () => {
    const { POST } = await import('../qiniu-token/route')
    const request = new Request('http://localhost/api/admin/uploads/qiniu-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'cover.png', contentType: 'image/png' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.token).toEqual(expect.any(String))
    expect(data.data.key).toMatch(/^covers\//)
    expect(data.data.domain).toBe('http://project.roydust.top')
    expect(data.data.uploadUrl).toBe('https://upload.qiniup.com')
  })

  test('uses avatar namespace when requested', async () => {
    const { POST } = await import('../qiniu-token/route')
    const request = new Request('http://localhost/api/admin/uploads/qiniu-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'profile.png', contentType: 'image/webp', purpose: 'avatar' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.data.key).toMatch(/^avatars\//)
  })

  test('rejects missing filename', async () => {
    const { POST } = await import('../qiniu-token/route')
    const request = new Request('http://localhost/api/admin/uploads/qiniu-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.success).toBe(false)
  })

  test('uses region-specific upload url from env when provided', async () => {
    process.env.QINIU_UPLOAD_URL = 'https://up-z2.qiniup.com'

    const { POST } = await import('../qiniu-token/route')
    const request = new Request('http://localhost/api/admin/uploads/qiniu-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'cover.png' }),
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.data.uploadUrl).toBe('https://up-z2.qiniup.com')
  })
})
