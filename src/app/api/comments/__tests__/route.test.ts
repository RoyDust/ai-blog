import { beforeEach, describe, expect, test, vi } from 'vitest'

const create = vi.fn()
const findFirstPost = vi.fn()
const createAdminNotification = vi.fn()
const findFirstParent = vi.fn()
const queryRaw = vi.fn()
const checkInteractionRateLimit = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    post: { findFirst: findFirstPost },
    comment: { create, findFirst: findFirstParent },
    $transaction: async (run: (tx: unknown) => Promise<unknown>) => run({
      post: { findFirst: findFirstPost },
      comment: { create, findFirst: findFirstParent },
      $queryRaw: queryRaw,
    }),
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  checkInteractionRateLimit: (...args: unknown[]) => checkInteractionRateLimit(...args),
}))

vi.mock('@/lib/notifications', () => ({
  createAdminNotification,
  NOTIFICATION_SEVERITIES: { info: 'INFO' },
  NOTIFICATION_TYPES: { commentCreated: 'COMMENT_CREATED' },
}))

vi.mock('next-auth', () => ({
  getServerSession: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

describe('/api/comments route', () => {
  beforeEach(() => {
    create.mockReset()
    findFirstPost.mockReset()
    createAdminNotification.mockReset()
    findFirstParent.mockReset()
    queryRaw.mockReset().mockResolvedValue([{ id: 'post-1' }])
    checkInteractionRateLimit.mockReset().mockResolvedValue({ allowed: true })
  })

  test('only exposes public POST and removes unused PATCH/DELETE write handlers', async () => {
    const routeModule = await import('../route')

    expect(typeof routeModule.POST).toBe('function')
    expect('GET' in routeModule).toBe(false)
    expect('PATCH' in routeModule).toBe(false)
    expect('PUT' in routeModule).toBe(false)
    expect('DELETE' in routeModule).toBe(false)
  })

  test('creates an anonymous comment using browser id and masked ip label', async () => {
    findFirstPost.mockResolvedValue({ id: 'post-1', slug: 'hello', title: 'Hello', published: true })
    create.mockResolvedValue({
      id: 'comment-1',
      content: 'Nice post',
      authorLabel: '203.0.*.*',
      browserId: 'anon_123',
    })

    const { POST } = await import('../route')
    const request = new Request('http://localhost/api/comments', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-browser-id': 'anon_123',
        'x-forwarded-for': '203.0.113.42',
      },
      body: JSON.stringify({ postId: 'post-1', content: 'Nice post' }),
    })
    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        postId: 'post-1',
        content: 'Nice post',
        status: 'PENDING',
        browserId: expect.stringMatching(/^anon_[a-f0-9]{64}$/),
        authorLabel: '203.0.*.*',
      }),
    }))
    expect(payload.success).toBe(true)
    expect(createAdminNotification).toHaveBeenCalledWith(expect.objectContaining({
      type: 'COMMENT_CREATED',
      title: '有新评论',
      body: '203.0.*.* 评论了《Hello》，等待审核。',
      actionUrl: '/admin/comments',
      entityType: 'comment',
      entityId: 'comment-1',
      dedupeKey: 'comment:comment-1:created',
    }))
  })

  test('rejects a reply when the parent is not public on this post', async () => {
    findFirstPost.mockResolvedValue({ id: 'post-1', slug: 'hello', title: 'Hello' })
    findFirstParent.mockResolvedValue(null)
    const { POST } = await import('../route')
    const response = await POST(new Request('http://localhost/api/comments', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-browser-id': 'anon_123' },
      body: JSON.stringify({ postId: 'post-1', content: 'Nice post', parentId: 'other-post-parent' }),
    }))
    expect(response.status).toBe(404)
    expect(create).not.toHaveBeenCalled()
    expect(createAdminNotification).not.toHaveBeenCalled()
  })

  test('rejects malformed anonymous browser ids', async () => {
    findFirstPost.mockResolvedValue({ id: 'post-1', published: true })

    const { POST } = await import('../route')
    const request = new Request('http://localhost/api/comments', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-browser-id': 'not safe',
        'x-forwarded-for': '203.0.113.42',
      },
      body: JSON.stringify({ postId: 'post-1', content: 'Nice post' }),
    })
    const response = await POST(request)
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload.error).toMatch(/browser id/i)
    expect(create).not.toHaveBeenCalled()
  })

  test('returns 429 when interaction rate limit is exceeded', async () => {
    checkInteractionRateLimit.mockResolvedValueOnce({ allowed: false })

    const { POST } = await import('../route')
    const response = await POST(new Request('http://localhost/api/comments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ postId: 'post-1', content: 'Nice post' }),
    }))

    expect(response.status).toBe(429)
    expect(create).not.toHaveBeenCalled()
  })
})
