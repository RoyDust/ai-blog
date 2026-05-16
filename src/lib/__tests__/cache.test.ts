import { beforeEach, describe, expect, test, vi } from 'vitest'

const { revalidatePath } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath,
}))

import {
  PUBLIC_REVALIDATE_SECONDS,
  buildCategoryPath,
  buildPostPath,
  buildSeriesPath,
  buildTagPath,
  revalidateBlogSettings,
  revalidatePublicContent,
} from '../cache'

describe('cache helpers', () => {
  beforeEach(() => {
    revalidatePath.mockReset()
  })

  test('exposes stable public revalidate window', () => {
    expect(PUBLIC_REVALIDATE_SECONDS).toBe(300)
  })

  test('builds canonical post path', () => {
    expect(buildPostPath('hello')).toBe('/posts/hello')
  })

  test('builds canonical series path', () => {
    expect(buildSeriesPath('nextjs-series')).toBe('/series/nextjs-series')
  })

  test('revalidates canonical public families plus old and new content paths', () => {
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

  test('ignores revalidate calls outside a Next request context', () => {
    revalidatePath.mockImplementation(() => {
      throw new Error('Invariant: static generation store missing in revalidatePath /')
    })

    expect(() => revalidatePublicContent({ slug: 'ai-daily-2026-05-13' })).not.toThrow()
    expect(() => revalidateBlogSettings()).not.toThrow()
  })
})
