import { describe, expect, test, vi } from 'vitest'

vi.mock('@/lib/blog-settings', () => ({
  getBlogSettings: () =>
    Promise.resolve({
      siteName: 'Configured Blog',
      siteDescription: 'Configured description',
      siteUrl: 'https://blog.example',
      locale: 'zh-CN',
    }),
}))

describe('utility page metadata', () => {
  test('marks search and bookmarks as noindex pages', async () => {
    const searchPage = await import('@/app/(public)/search/page')
    const bookmarksPage = await import('@/app/(public)/bookmarks/page')
    const authLayout = await import('@/app/(auth)/layout')
    const searchMetadata = await searchPage.generateMetadata()
    const bookmarksMetadata = await bookmarksPage.generateMetadata()

    expect(searchMetadata.robots).toEqual({ index: false, follow: true })
    expect(searchMetadata.alternates?.canonical).toBe('https://blog.example/search')
    expect(bookmarksMetadata.robots).toEqual({ index: false, follow: true })
    expect(bookmarksMetadata.alternates?.canonical).toBe('https://blog.example/bookmarks')
    expect(authLayout.metadata.robots).toEqual({ index: false, follow: true })
  })
})
