import { beforeEach, describe, expect, test, vi } from 'vitest'

const findMany = vi.fn()

/**
 * 这里只关心公共 GET 的行为，因此仅模拟标签查询依赖。
 */
vi.mock('@/lib/prisma', () => ({
  prisma: {
    tag: {
      findMany,
    },
  },
}))

describe('GET /api/tags', () => {
  beforeEach(() => {
    // 确保每个用例都从干净的 mock 状态开始。
    findMany.mockReset()
  })

  test('returns tags without loading auth config', async () => {
    findMany.mockResolvedValue([{ id: 't1', name: 'Next.js', slug: 'nextjs', _count: { posts: 3 } }])

    const { GET } = await import('../route')
    const response = await GET()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.success).toBe(true)
    expect(payload.data).toHaveLength(1)
  })
})
