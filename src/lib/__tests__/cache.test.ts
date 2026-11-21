import { beforeEach, describe, expect, test, vi } from 'vitest'

const { revalidatePath, revalidateTag, unstable_cache } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath,
  revalidateTag,
  unstable_cache,
}))

import {
  PUBLIC_CACHE_TAGS,
  PUBLIC_REVALIDATE_SECONDS,
  buildCategoryPath,
  buildPostPath,
  buildSeriesPath,
  buildTagPath,
  buildTopicGuidePath,
  createPublicCachedReader,
  revalidateBlogSettings,
  revalidatePublicContent,
  revalidatePublicContentStrict,
  revalidatePublicPathsStrict,
  revalidateTopicGuides,
} from '../cache'

describe('cache helpers', () => {
  beforeEach(() => {
    revalidatePath.mockReset()
    revalidateTag.mockReset()
    unstable_cache.mockReset()
  })

  test('exposes stable public revalidate window and semantic tags', () => {
    expect(PUBLIC_REVALIDATE_SECONDS).toBe(300)
    expect(PUBLIC_CACHE_TAGS).toEqual({
      posts: 'public-posts',
      categories: 'public-categories',
      tags: 'public-tags',
      blogSettings: 'blog-settings',
      topicGuides: 'topic-guides',
    })
  })

  test('builds canonical post, series, and topic guide paths', () => {
    expect(buildPostPath('hello')).toBe('/posts/hello')
    expect(buildSeriesPath('nextjs-series')).toBe('/series/nextjs-series')
    expect(buildTopicGuidePath('react-guide')).toBe('/guides/react-guide')
  })

  test('revalidates canonical public families, old/new content paths, and semantic tags', () => {
    revalidatePublicContent({
      slug: 'new-slug',
      previousSlug: 'old-slug',
      categorySlug: 'new-category',
      previousCategorySlug: 'old-category',
      tagSlugs: ['react', 'nextjs'],
      previousTagSlugs: ['legacy', 'react'],
      seriesSlug: 'new-series',
      previousSeriesSlug: 'old-series',
    })

    expect(revalidatePath.mock.calls).toEqual([
      ['/'],
      ['/posts'],
      ['/archives'],
      ['/series'],
      [buildPostPath('new-slug')],
      [buildPostPath('old-slug')],
      [buildCategoryPath('new-category')],
      [buildCategoryPath('old-category')],
      [buildTagPath('react')],
      [buildTagPath('nextjs')],
      [buildTagPath('legacy')],
      [buildSeriesPath('new-series')],
      [buildSeriesPath('old-series')],
    ])
    expect(revalidateTag.mock.calls).toEqual([
      ['public-posts', 'max'],
      ['public-categories', 'max'],
      ['public-tags', 'max'],
    ])
  })

  test('normalizes and de-duplicates slug-like invalidation inputs before revalidating', () => {
    revalidatePublicContent({
      slug: ' current-slug ',
      previousSlug: 'current-slug',
      categorySlug: ' frontend ',
      previousCategorySlug: '',
      tagSlugs: [' react ', 'react', ''],
      previousTagSlugs: [' legacy ', 'react'],
      seriesSlug: ' series-one ',
      previousSeriesSlug: 'series-one',
    })

    expect(revalidatePath.mock.calls).toEqual([
      ['/'],
      ['/posts'],
      ['/archives'],
      ['/series'],
      [buildPostPath('current-slug')],
      [buildCategoryPath('frontend')],
      [buildTagPath('react')],
      [buildTagPath('legacy')],
      [buildSeriesPath('series-one')],
    ])
  })

  test('revalidates topic guide listing, old/new guide detail, sitemap, and topic-guides tag', () => {
    revalidateTopicGuides({
      slug: ' new-guide ',
      previousSlug: 'old-guide',
    })

    expect(revalidatePath.mock.calls).toEqual([
      ['/'],
      ['/guides'],
      ['/guides/new-guide'],
      ['/guides/old-guide'],
      ['/sitemap.xml'],
    ])
    expect(revalidateTag).toHaveBeenCalledWith('topic-guides', 'max')
  })

  test('revalidates blog settings paths and blog-settings tag', () => {
    revalidateBlogSettings()

    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout')
    expect(revalidatePath).toHaveBeenCalledWith('/about')
    expect(revalidatePath).toHaveBeenCalledWith('/contact')
    expect(revalidatePath).toHaveBeenCalledWith('/llms.txt')
    expect(revalidatePath).toHaveBeenCalledWith('/api/ai/openapi')
    expect(revalidatePath).toHaveBeenCalledWith('/guides')
    expect(revalidateTag).toHaveBeenCalledWith('blog-settings', 'max')
  })

  test('ignores revalidate calls outside a Next request context', () => {
    revalidatePath.mockImplementation(() => {
      throw new Error('Invariant: static generation store missing in revalidatePath /')
    })
    revalidateTag.mockImplementation(() => {
      throw new Error('Invariant: static generation store missing in revalidateTag public-posts')
    })

    expect(() => revalidatePublicContent({ slug: 'ai-daily-2026-05-13' })).not.toThrow()
    expect(() => revalidateTopicGuides({ slug: 'react-guide' })).not.toThrow()
    expect(() => revalidateBlogSettings()).not.toThrow()
  })

  test('strict revalidation reports failed paths, tries remaining paths, and invalidates matching tags', () => {
    revalidatePath.mockImplementation((path: string) => {
      if (path === '/posts/old') throw new Error('cache unavailable')
    })
    const result = revalidatePublicContentStrict({ previousSlug: 'old', slug: 'new' })
    expect(result.errors).toEqual([{ path: '/posts/old', error: 'cache unavailable' }])
    expect(result.paths).toContain('/posts/new')
    expect(revalidatePath).toHaveBeenCalledWith('/posts/new')
    expect(revalidateTag).toHaveBeenCalledWith('public-posts', 'max')

    revalidateTag.mockClear()
    revalidatePublicPathsStrict(['/categories', '/tags/nextjs', '/guides/start'])
    expect(revalidateTag.mock.calls).toEqual([
      ['public-categories', 'max'],
      ['public-tags', 'max'],
      ['topic-guides', 'max'],
    ])
  })

  test('createPublicCachedReader configures unstable_cache with 300s TTL, rehydrates dates, and falls back when incrementalCache is missing', async () => {
    const query = vi.fn(async (slug: string) => ({
      slug,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
    }))

    unstable_cache.mockImplementationOnce((cb) => async (slug: string) => {
      const raw = await cb(slug)
      return JSON.parse(JSON.stringify(raw))
    })

    const reader = createPublicCachedReader(query, {
      keyParts: ['test-reader'],
      tags: [PUBLIC_CACHE_TAGS.posts],
      rehydrate: (value) => ({
        ...value,
        createdAt: new Date(value.createdAt),
      }),
    })

    const cachedValue = await reader('hello')
    expect(unstable_cache).toHaveBeenCalledWith(query, ['test-reader'], {
      revalidate: 300,
      tags: ['public-posts'],
    })
    expect(cachedValue.createdAt).toBeInstanceOf(Date)
    expect(cachedValue.createdAt.toISOString()).toBe('2026-04-01T00:00:00.000Z')

    // Missing incrementalCache store falls back to direct query call
    unstable_cache.mockImplementationOnce(() => async () => {
      throw new Error('Invariant: incrementalCache missing in unstable_cache')
    })
    const fallbackReader = createPublicCachedReader(query, {
      keyParts: ['fallback-reader'],
      tags: [PUBLIC_CACHE_TAGS.posts],
    })
    await expect(fallbackReader('direct')).resolves.toMatchObject({ slug: 'direct' })

    // Underlying DB error is NOT swallowed inside createPublicCachedReader
    const dbError = new Error('connect ECONNREFUSED 127.0.0.1:1')
    const failingQuery = vi.fn(async () => {
      throw dbError
    })
    unstable_cache.mockImplementationOnce((cb) => cb)
    const failingReader = createPublicCachedReader(failingQuery, {
      keyParts: ['failing-reader'],
      tags: [PUBLIC_CACHE_TAGS.blogSettings],
    })
    await expect(failingReader()).rejects.toThrow('connect ECONNREFUSED 127.0.0.1:1')
  })
})
