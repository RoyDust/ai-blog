import { beforeEach, describe, expect, test, vi } from 'vitest'

await vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import('node:async_hooks')
  globalThis.AsyncLocalStorage ??= AsyncLocalStorage
})

const findMany = vi.fn()
const count = vi.fn()
const findTag = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tag: { findFirst: findTag },
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
    findTag.mockReset().mockResolvedValue({ id: 'active-react' })
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
          category: { slug: 'frontend', deletedAt: null },
          tags: { some: { id: 'active-react', deletedAt: null } },
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

  test('guards category filter with deletedAt: null and caches public post pages with Date rehydration', async () => {
    const store = new Map<string, { value: unknown; tags?: string[] }>()
    const setSpy = vi.fn(async (key: string, value: unknown, ctx?: { tags?: string[] }) => {
      store.set(key, { value, tags: ctx?.tags })
    })
    const globalWithCache = globalThis as unknown as { __incrementalCache?: unknown }
    const previousCache = globalWithCache.__incrementalCache
    globalWithCache.__incrementalCache = {
      isOnDemandRevalidate: false,
      generateCacheKey: async (invocationKey: string) => invocationKey,
      get: async (key: string) => {
        const hit = store.get(key)
        return hit ? { isStale: false, value: hit.value } : null
      },
      set: setSpy,
    }

    try {
      const { getPublishedPostsPage } = await import('../posts')
      const createdAt = new Date('2026-05-01T08:00:00.000Z')
      findMany.mockResolvedValueOnce([
        {
          id: 'p1',
          title: 'Cached Post',
          slug: 'cached-post',
          generatedByAiNews: false,
          excerpt: 'summary',
          coverImage: null,
          featured: false,
          createdAt,
          readingTimeMinutes: 3,
          viewCount: 5,
          author: { id: 'u1', name: 'Ada', image: null },
          category: { id: 'c1', name: 'Frontend', slug: 'frontend' },
          tags: [],
          _count: { comments: 0, likes: 0 },
        },
      ])
      count.mockResolvedValueOnce(1)

      const first = await getPublishedPostsPage({ page: 1, limit: 10, category: ' frontend ' })
      expect(findMany).toHaveBeenCalledTimes(1)
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            published: true,
            deletedAt: null,
            category: { slug: 'frontend', deletedAt: null },
          },
        }),
      )
      expect(setSpy).toHaveBeenCalledTimes(1)
      expect(setSpy.mock.calls[0]?.[2]).toMatchObject({
        tags: ['public-posts', 'public-categories', 'public-tags'],
      })
      expect(first.posts[0]?.createdAt).toBeInstanceOf(Date)

      // Cache hit with undefined vs null search filters shares normalized key and rehydrates Date
      const second = await getPublishedPostsPage({
        page: 1,
        limit: 10,
        category: 'frontend',
        tag: null,
        search: undefined,
      })
      expect(findMany).toHaveBeenCalledTimes(1)
      expect(second.posts[0]?.createdAt).toBeInstanceOf(Date)
      expect(second.posts[0]?.createdAt.toISOString()).toBe('2026-05-01T08:00:00.000Z')
    } finally {
      if (previousCache === undefined) {
        delete globalWithCache.__incrementalCache
      } else {
        globalWithCache.__incrementalCache = previousCache
      }
    }
  })

  test('does not fall back to all posts when the active tag is missing', async () => {
    findTag.mockResolvedValue(null)
    const { getPublishedPostsPage } = await import('../posts')
    expect(await getPublishedPostsPage({ page: 1, limit: 10, tag: 'removed' })).toEqual({
      posts: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    })
    expect(findMany).not.toHaveBeenCalled()
    expect(count).not.toHaveBeenCalled()
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

  test('prioritizes non-AI posts while allowing AI posts to fill the home limit', async () => {
    const { getHomeLatestPosts } = await import('../posts')

    await getHomeLatestPosts(5)

    expect(findMany).toHaveBeenCalledWith({
      where: { published: true, deletedAt: null },
      select: expect.objectContaining({ generatedByAiNews: true }),
      orderBy: [
        { generatedByAiNews: 'asc' },
        { featured: 'desc' },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: 5,
    })
  })

  test('filters original vs AI daily posts when type is specified', async () => {
    const { getPublishedPostsPage } = await import('../posts')

    await getPublishedPostsPage({ page: 1, limit: 10, type: 'original' })
    expect(findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          published: true,
          deletedAt: null,
          generatedByAiNews: false,
        },
      }),
    )

    await getPublishedPostsPage({ page: 1, limit: 10, type: 'ai-daily' })
    expect(findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          published: true,
          deletedAt: null,
          generatedByAiNews: true,
        },
      }),
    )
  })
})
