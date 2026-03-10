import { beforeEach, describe, expect, test, vi } from 'vitest'

const findMany = vi.fn()
const count = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    post: {
      findMany,
      count,
    },
  },
}))

describe('getPublishedPostsPage', () => {
  beforeEach(() => {
    findMany.mockReset()
    count.mockReset()
    findMany.mockResolvedValue([])
    count.mockResolvedValue(0)
  })

  test('selects lightweight listing fields without loading post content', async () => {
    const { getPublishedPostsPage } = await import('../posts')

    await getPublishedPostsPage({ page: 1, limit: 10 })

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          coverImage: true,
          createdAt: true,
          viewCount: true,
          author: expect.any(Object),
          category: expect.any(Object),
          tags: expect.any(Object),
          _count: expect.any(Object),
        }),
      }),
    )

    expect(findMany).toHaveBeenCalledWith(
      expect.not.objectContaining({
        include: expect.anything(),
      }),
    )

    const args = findMany.mock.calls[0]?.[0]
    expect(args.select).not.toHaveProperty('content')
  })
})
