import { beforeEach, describe, expect, test, vi } from 'vitest'

const getServerSession = vi.fn()
const count = vi.fn()
const findMany = vi.fn()
const updateManyCategory = vi.fn()
const updateManyPost = vi.fn()
const transaction = vi.fn()

vi.mock('next-auth', () => ({
  getServerSession,
}))

vi.mock('@/lib/auth', () => ({
  authOptions: {},
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    category: {
      count,
      findMany,
      updateMany: updateManyCategory,
    },
    post: {
      updateMany: updateManyPost,
    },
    $transaction: transaction,
  },
}))

describe('DELETE /api/admin/categories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns a failure response when the category cleanup transaction fails', async () => {
    getServerSession.mockResolvedValueOnce({ user: { id: 'admin-1', role: 'ADMIN' } })
    findMany.mockResolvedValueOnce([{ id: 'cat-1' }])
    updateManyCategory.mockReturnValueOnce({ kind: 'category-op' })
    updateManyPost.mockReturnValueOnce({ kind: 'post-op' })
    transaction.mockRejectedValueOnce(new Error('transaction failed'))

    const { DELETE } = await import('../route')
    const response = await DELETE(new Request('http://localhost/api/admin/categories?ids=cat-1'))
    const payload = await response.json()

    expect(transaction).toHaveBeenCalledWith([
      { kind: 'category-op' },
      { kind: 'post-op' },
    ])
    expect(response.status).toBe(500)
    expect(payload).toEqual({ error: 'Failed to delete category' })
  })
})

describe('GET /api/admin/categories', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('paginates category management rows on the server', async () => {
    getServerSession.mockResolvedValueOnce({ user: { id: 'admin-1', role: 'ADMIN' } })
    count.mockResolvedValueOnce(23)
    findMany.mockResolvedValueOnce([{ id: 'cat-11', name: 'Engineering', slug: 'engineering' }])

    const { GET } = await import('../route')
    const response = await GET(new Request('http://localhost/api/admin/categories?page=2&limit=10&q=eng'))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 10,
      take: 10,
      where: expect.objectContaining({
        OR: expect.any(Array),
      }),
    }))
    expect(payload.pagination).toEqual({ page: 2, limit: 10, total: 23, totalPages: 3 })
  })
})
