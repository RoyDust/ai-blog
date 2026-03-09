import { beforeEach, describe, expect, test, vi } from 'vitest'

const create = vi.fn()
const findFirstPost = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    post: { findFirst: findFirstPost },
    comment: { create },
  },
}))

vi.mock('@/lib/validation', () => ({
  parseCommentInput: () => ({ postId: 'post-1', content: 'Nice post', parentId: null }),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkInteractionRateLimit: () => ({ allowed: true }),
}))

vi.mock('next-auth', () => ({
  getServerSession: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

describe('POST /api/comments', () => {
  beforeEach(() => {
    create.mockReset()
    findFirstPost.mockReset()
  })

  test('creates an anonymous comment using browser id and masked ip label', async () => {
    findFirstPost.mockResolvedValue({ id: 'post-1', published: true })
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
        browserId: 'anon_123',
        authorLabel: '203.0.*.*',
      }),
    }))
    expect(payload.success).toBe(true)
  })
})
