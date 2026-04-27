import { describe, expect, test } from 'vitest'

describe('utility page metadata', () => {
  test('marks search and bookmarks as noindex pages', async () => {
    const searchPage = await import('@/app/(public)/search/page')
    const bookmarksPage = await import('@/app/(public)/bookmarks/page')
    const authLayout = await import('@/app/(auth)/layout')

    expect(searchPage.metadata.robots).toEqual({ index: false, follow: true })
    expect(bookmarksPage.metadata.robots).toEqual({ index: false, follow: true })
    expect(authLayout.metadata.robots).toEqual({ index: false, follow: true })
  })
})
