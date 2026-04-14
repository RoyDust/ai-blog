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

  test('searches with deterministic public filters while keeping list queries lightweight', async () => {
    const { getPublishedPostsPage } = await import('../posts')

    await getPublishedPostsPage({ page: 2, limit: 12, category: 'frontend', tag: 'react', search: 'hooks' })

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          published: true,
          deletedAt: null,
          category: { slug: 'frontend' },
          tags: { some: { slug: 'react' } },
          OR: [
            { title: { contains: 'hooks', mode: 'insensitive' } },
            { excerpt: { contains: 'hooks', mode: 'insensitive' } },
          ],
        },
        orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        skip: 12,
        take: 12,
      }),
    )
  })

  test('exposes reusable public query fragments for listing and taxonomy surfaces', async () => {
    const { PUBLIC_POST_ORDER_BY, buildOffsetPagination, getFeaturedPosts, getPublicPostSelect } = await import('../posts')

    expect(PUBLIC_POST_ORDER_BY).toEqual([{ featured: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }])
    expect(getPublicPostSelect()).toMatchObject({
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      coverImage: true,
      featured: true,
      createdAt: true,
      viewCount: true,
      tags: {
        where: { deletedAt: null },
        select: { id: true, name: true, slug: true },
      },
    })
    expect(getPublicPostSelect({ includeTagColor: true })).toMatchObject({
      tags: {
        select: { id: true, name: true, slug: true, color: true },
      },
    })
    expect(buildOffsetPagination({ page: 2, limit: 12, total: 13 })).toEqual({
      page: 2,
      limit: 12,
      total: 13,
      totalPages: 2,
    })

    await getFeaturedPosts(3)

    expect(findMany).toHaveBeenLastCalledWith({
      where: { published: true, featured: true, deletedAt: null },
      select: expect.objectContaining({ featured: true }),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 3,
    })
  })
})
