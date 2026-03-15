import { beforeEach, describe, expect, test, vi } from 'vitest'

const findFirstPost = vi.fn()
const count = vi.fn()
const create = vi.fn()
const remove = vi.fn()
const findFirst = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    post: { findFirst: findFirstPost },
    like: {
      count,
      create,
      delete: remove,
      findFirst,
    },
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  checkInteractionRateLimit: () => ({ allowed: true }),
}))

vi.mock('next-auth', () => ({
  getServerSession: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

describe('POST /api/posts/[slug]/like', () => {
  beforeEach(() => {
    findFirstPost.mockReset()
    count.mockReset()
    create.mockReset()
    remove.mockReset()
    findFirst.mockReset()
  })

  test('toggles likes using browser id without login', async () => {
    findFirstPost.mockResolvedValue({ id: 'post-1', slug: 'hello' })
    findFirst.mockResolvedValue(null)

    const { POST } = await import('../route')
    const request = new Request('http://localhost/api/posts/hello/like', {
      method: 'POST',
      headers: { 'x-browser-id': 'anon_123' },
    })
    const response = await POST(request, { params: Promise.resolve({ slug: 'hello' }) })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(create).toHaveBeenCalledWith({ data: { postId: 'post-1', browserId: expect.stringMatching(/^anon_[a-f0-9]{64}$/) } })
    expect(payload.liked).toBe(true)
  })

  test('returns current like state for browser id', async () => {
    findFirstPost.mockResolvedValue({ id: 'post-1', slug: 'hello' })
    count.mockResolvedValue(5)
    findFirst.mockResolvedValue({ id: 'like-1' })

    const { GET } = await import('../route')
    const request = new Request('http://localhost/api/posts/hello/like', {
      headers: { 'x-browser-id': 'anon_123' },
    })
    const response = await GET(request, { params: Promise.resolve({ slug: 'hello' }) })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data).toEqual({ count: 5, liked: true })
  })
})
