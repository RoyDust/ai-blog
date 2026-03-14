import { describe, expect, test, vi } from 'vitest'

const { revalidatePath } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath,
}))

import {
  PUBLIC_REVALIDATE_SECONDS,
  buildPostPath,
  revalidatePublicContent,
} from '../cache'

describe('cache helpers', () => {
  test('exposes stable public revalidate window', () => {
    expect(PUBLIC_REVALIDATE_SECONDS).toBe(300)
  })

  test('builds canonical post path', () => {
    expect(buildPostPath('hello')).toBe('/posts/hello')
  })

  test('revalidates canonical list and both old/new slug-like paths', () => {
    revalidatePath.mockClear()

    revalidatePublicContent({
      slug: 'new-post',
      previousSlug: 'old-post',
      categorySlug: 'frontend',
      previousCategorySlug: 'legacy-frontend',
      tagSlugs: ['react', 'nextjs'],
      previousTagSlugs: ['legacy-tag', 'react'],
    })

    expect(revalidatePath.mock.calls).toEqual([
      ['/'],
      ['/posts'],
      ['/archives'],
      ['/posts/new-post'],
      ['/posts/old-post'],
      ['/categories/frontend'],
      ['/categories/legacy-frontend'],
      ['/tags/react'],
      ['/tags/nextjs'],
      ['/tags/legacy-tag'],
    ])
  })
})
