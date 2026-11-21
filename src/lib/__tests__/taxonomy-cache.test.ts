import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

await vi.hoisted(async () => {
  const { AsyncLocalStorage } = await import('node:async_hooks')
  globalThis.AsyncLocalStorage ??= AsyncLocalStorage
})

const categoryFindMany = vi.fn()
const categoryFindFirst = vi.fn()
const tagFindMany = vi.fn()
const tagFindFirst = vi.fn()
const postFindMany = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    category: {
      findMany: categoryFindMany,
      findFirst: categoryFindFirst,
    },
    tag: {
      findMany: tagFindMany,
      findFirst: tagFindFirst,
    },
    post: {
      findMany: postFindMany,
    },
  },
}))

describe('taxonomy public cached readers', () => {
  const store = new Map<string, { value: unknown; tags?: string[] }>()
  const setSpy = vi.fn(async (key: string, value: unknown, ctx?: { tags?: string[] }) => {
    store.set(key, { value, tags: ctx?.tags })
  })
  const globalWithCache = globalThis as unknown as { __incrementalCache?: unknown }
  const previousCache = globalWithCache.__incrementalCache

  beforeEach(() => {
    vi.clearAllMocks()
    store.clear()
    globalWithCache.__incrementalCache = {
      isOnDemandRevalidate: false,
      generateCacheKey: async (invocationKey: string) => invocationKey,
      get: async (key: string) => {
        const hit = store.get(key)
        return hit ? { isStale: false, value: hit.value } : null
      },
      set: setSpy,
    }
  })

  afterEach(() => {
    if (previousCache === undefined) {
      delete globalWithCache.__incrementalCache
    } else {
      globalWithCache.__incrementalCache = previousCache
    }
  })

  test('caches category and tag directories with semantic tags and rehydrates Date fields', async () => {
    categoryFindMany.mockResolvedValueOnce([
      {
        id: 'c1',
        name: 'Frontend',
        slug: 'frontend',
        description: null,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        _count: { posts: 2 },
      },
    ])
    tagFindMany.mockResolvedValueOnce([
      {
        id: 't1',
        name: 'Next.js',
        slug: 'nextjs',
        color: '#000',
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
        _count: { posts: 3 },
      },
    ])

    const { getCategoryDirectory, getTagDirectory } = await import('../taxonomy')

    const firstCategories = await getCategoryDirectory()
    const secondCategories = await getCategoryDirectory()
    expect(categoryFindMany).toHaveBeenCalledTimes(1)
    expect(firstCategories[0]?.createdAt).toBeInstanceOf(Date)
    expect(secondCategories[0]?.createdAt).toBeInstanceOf(Date)

    const firstTags = await getTagDirectory()
    const secondTags = await getTagDirectory()
    expect(tagFindMany).toHaveBeenCalledTimes(1)
    expect(firstTags[0]?.createdAt).toBeInstanceOf(Date)
    expect(secondTags[0]?.createdAt).toBeInstanceOf(Date)

    expect(setSpy.mock.calls.map((call) => call[2]?.tags)).toEqual([
      ['public-categories', 'public-posts'],
      ['public-tags', 'public-posts'],
    ])
  })

  test('shares category and tag detail cache keys across default and explicit page 1 arguments', async () => {
    categoryFindFirst.mockResolvedValueOnce({
      id: 'c1',
      name: 'Frontend',
      slug: 'frontend',
      description: 'UI',
      createdAt: new Date('2026-02-01T00:00:00.000Z'),
      _count: { posts: 1 },
    })
    postFindMany.mockResolvedValueOnce([
      {
        id: 'p1',
        title: 'Post 1',
        slug: 'post-1',
        generatedByAiNews: false,
        excerpt: null,
        coverImage: null,
        featured: false,
        createdAt: new Date('2026-02-02T00:00:00.000Z'),
        readingTimeMinutes: 2,
        viewCount: 1,
        author: { id: 'u1', name: 'Roy', image: null },
        category: { id: 'c1', name: 'Frontend', slug: 'frontend' },
        tags: [],
        _count: { comments: 0, likes: 0 },
      },
    ])

    const { TAXONOMY_PAGE_SIZE, getCategoryDetail } = await import('../taxonomy')
    await getCategoryDetail('frontend')
    const hit = await getCategoryDetail('frontend', { page: 1, limit: TAXONOMY_PAGE_SIZE })

    expect(categoryFindFirst).toHaveBeenCalledTimes(1)
    expect(postFindMany).toHaveBeenCalledTimes(1)
    expect(hit?.createdAt).toBeInstanceOf(Date)
    expect(hit?.posts[0]?.createdAt).toBeInstanceOf(Date)
  })
})
