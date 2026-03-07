import { beforeEach, describe, expect, test, vi } from 'vitest'

const findMany = vi.fn()

/**
 * 这里只关心公共 GET 的行为，因此仅模拟分类查询依赖。
 */
vi.mock('@/lib/prisma', () => ({
  prisma: {
    category: {
      findMany,
    },
  },
}))

describe('GET /api/categories', () => {
  beforeEach(() => {
    // 确保每个用例都从干净的 mock 状态开始。
    findMany.mockReset()
  })

  test('returns categories without loading auth config', async () => {
    findMany.mockResolvedValue([{ id: 'c1', name: 'Frontend', slug: 'frontend', _count: { posts: 2 } }])

    const { GET } = await import('../route')
    const response = await GET()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data).toHaveLength(1)
  })
})
