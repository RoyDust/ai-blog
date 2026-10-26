import { beforeEach, describe, expect, test, vi } from 'vitest'

const findFirstPost = vi.fn()
const count = vi.fn()
const create = vi.fn()
const deleteMany = vi.fn()
const findFirst = vi.fn()
const getServerSession = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    post: { findFirst: findFirstPost },
    like: {
      count,
      create,
      deleteMany,
      findFirst,
    },
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  checkInteractionRateLimit: () => ({ allowed: true }),
}))

vi.mock('next-auth', () => ({
  getServerSession: (...args: unknown[]) => getServerSession(...args),
}))

vi.mock('@/lib/auth', () => ({ authOptions: {} }))

const HASHED_BROWSER_ID = expect.stringMatching(/^anon_[a-f0-9]{64}$/)

function postRequest(headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/posts/hello/like', { method: 'POST', headers })
}

describe('POST /api/posts/[slug]/like', () => {
  beforeEach(() => {
    findFirstPost.mockReset()
    count.mockReset()
    create.mockReset()
    deleteMany.mockReset()
    findFirst.mockReset()
    getServerSession.mockReset()
    getServerSession.mockResolvedValue(null)
    findFirstPost.mockResolvedValue({ id: 'post-1' })
    count.mockResolvedValue(6)
  })

  test('likes with the hashed browser id when no row existed', async () => {
    deleteMany.mockResolvedValue({ count: 0 })
    create.mockResolvedValue({ id: 'like-1' })

    const { POST } = await import('../route')
    const response = await POST(postRequest({ 'x-browser-id': 'anon_123' }), { params: Promise.resolve({ slug: 'hello' }) })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(deleteMany).toHaveBeenCalledWith({ where: { postId: 'post-1', OR: [{ browserId: HASHED_BROWSER_ID }] } })
    expect(create).toHaveBeenCalledWith({ data: { postId: 'post-1', userId: null, browserId: HASHED_BROWSER_ID } })
    expect(payload).toEqual({ success: true, liked: true, count: 6 })
  })

  test('unlikes when the identity already owned a like', async () => {
    deleteMany.mockResolvedValue({ count: 1 })

    const { POST } = await import('../route')
    const response = await POST(postRequest({ 'x-browser-id': 'anon_123' }), { params: Promise.resolve({ slug: 'hello' }) })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(create).not.toHaveBeenCalled()
    expect(payload).toEqual({ success: true, liked: false, count: 6 })
  })

  test('attributes the like to the logged-in user even without a browser id', async () => {
    getServerSession.mockResolvedValue({ user: { id: 'user-1', role: 'USER' } })
    deleteMany.mockResolvedValue({ count: 0 })
    create.mockResolvedValue({ id: 'like-1' })

    const { POST } = await import('../route')
    const response = await POST(postRequest(), { params: Promise.resolve({ slug: 'hello' }) })

    expect(response.status).toBe(200)
    expect(deleteMany).toHaveBeenCalledWith({ where: { postId: 'post-1', OR: [{ userId: 'user-1' }] } })
    expect(create).toHaveBeenCalledWith({ data: { postId: 'post-1', userId: 'user-1', browserId: null } })
  })

  test('answers liked when a concurrent request already inserted the row', async () => {
    deleteMany.mockResolvedValue({ count: 0 })
    create.mockRejectedValue({ code: 'P2002', meta: { target: ['postId', 'browserId'] } })

    const { POST } = await import('../route')
    const response = await POST(postRequest({ 'x-browser-id': 'anon_123' }), { params: Promise.resolve({ slug: 'hello' }) })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({ success: true, liked: true, count: 6 })
  })

  test('rejects anonymous requests without a valid browser id', async () => {
    const { POST } = await import('../route')
    const response = await POST(postRequest(), { params: Promise.resolve({ slug: 'hello' }) })
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({ error: 'Valid browser ID is required' })
    expect(deleteMany).not.toHaveBeenCalled()
  })

  test('returns 404 for unpublished or missing posts', async () => {
    findFirstPost.mockResolvedValue(null)

    const { POST } = await import('../route')
    const response = await POST(postRequest({ 'x-browser-id': 'anon_123' }), { params: Promise.resolve({ slug: 'hello' }) })

    expect(response.status).toBe(404)
    expect(deleteMany).not.toHaveBeenCalled()
  })
})

describe('GET /api/posts/[slug]/like', () => {
  beforeEach(() => {
    findFirstPost.mockReset()
    count.mockReset()
    findFirst.mockReset()
    getServerSession.mockReset()
    getServerSession.mockResolvedValue(null)
    findFirstPost.mockResolvedValue({ id: 'post-1' })
  })

  test('returns current like state for browser id', async () => {
    count.mockResolvedValue(5)
    findFirst.mockResolvedValue({ id: 'like-1' })

    const { GET } = await import('../route')
    const request = new Request('http://localhost/api/posts/hello/like', {
      headers: { 'x-browser-id': 'anon_123' },
    })
    const response = await GET(request, { params: Promise.resolve({ slug: 'hello' }) })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(findFirst).toHaveBeenCalledWith({
      where: { postId: 'post-1', OR: [{ browserId: HASHED_BROWSER_ID }] },
      select: { id: true },
    })
    expect(payload.data).toEqual({ count: 5, liked: true })
  })

  test('returns the count with liked=false when the visitor has no identity', async () => {
    count.mockResolvedValue(5)

    const { GET } = await import('../route')
    const response = await GET(new Request('http://localhost/api/posts/hello/like'), { params: Promise.resolve({ slug: 'hello' }) })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(findFirst).not.toHaveBeenCalled()
    expect(payload.data).toEqual({ count: 5, liked: false })
  })
})
