import { describe, expect, test, vi } from 'vitest'

import {
  addBookmark,
  getBookmarkedSlugs,
  getBookmarks,
  isBookmarked,
  removeBookmark,
} from '@/lib/bookmark-store'

describe('bookmark local store', () => {
  test('adds and reads bookmark records', () => {
    addBookmark({ slug: 'hello-world', title: 'Hello World' })

    expect(isBookmarked('hello-world')).toBe(true)
    expect(getBookmarkedSlugs()).toEqual(['hello-world'])
    expect(getBookmarks()[0]).toMatchObject({ slug: 'hello-world', title: 'Hello World' })
  })

  test('deduplicates bookmarks by slug', () => {
    addBookmark({ slug: 'hello-world', title: 'Hello World' })
    addBookmark({ slug: 'hello-world', title: 'Hello World updated' })

    expect(getBookmarks()).toHaveLength(1)
    expect(getBookmarks()[0].title).toBe('Hello World updated')
  })

  test('removes bookmarks by slug', () => {
    addBookmark({ slug: 'hello-world', title: 'Hello World' })
    removeBookmark('hello-world')

    expect(isBookmarked('hello-world')).toBe(false)
    expect(getBookmarkedSlugs()).toEqual([])
  })

  test('degrades gracefully when localStorage throws SecurityError', () => {
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError')
    })
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError')
    })

    try {
      expect(getBookmarks()).toEqual([])
      expect(isBookmarked('hello-world')).toBe(false)
      expect(() => addBookmark({ slug: 'hello-world', title: 'Hello World' })).not.toThrow()
      expect(() => removeBookmark('hello-world')).not.toThrow()
    } finally {
      getItemSpy.mockRestore()
      setItemSpy.mockRestore()
    }
  })
})
