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

  test('revalidates canonical public families plus old and new content paths', () => {
    revalidatePublicContent({
      slug: 'new-slug',
      previousSlug: 'old-slug',
      categorySlug: 'new-category',
      previousCategorySlug: 'old-category',
      tagSlugs: ['react', 'nextjs'],
      previousTagSlugs: ['legacy', 'react'],
    })

    expect(revalidatePath.mock.calls).toEqual([
      ['/'],
      ['/posts'],
      ['/archives'],
      [buildPostPath('new-slug')],
      [buildPostPath('old-slug')],
      [buildCategoryPath('new-category')],
      [buildCategoryPath('old-category')],
      [buildTagPath('react')],
      [buildTagPath('nextjs')],
      [buildTagPath('legacy')],
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
    })

    expect(revalidatePath.mock.calls).toEqual([
      ['/'],
      ['/posts'],
      ['/archives'],
      [buildPostPath('current-slug')],
      [buildCategoryPath('frontend')],
      [buildTagPath('react')],
      [buildTagPath('legacy')],
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
