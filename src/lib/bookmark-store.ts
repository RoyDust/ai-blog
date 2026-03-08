export interface BookmarkRecord {
  slug: string
  title: string
  excerpt?: string
  createdAt?: string
}

const BOOKMARK_STORAGE_KEY = 'local-bookmarks'

function readBookmarks() {
  if (typeof window === 'undefined') {
    return [] as BookmarkRecord[]
  }

  const raw = window.localStorage.getItem(BOOKMARK_STORAGE_KEY)
  if (!raw) {
    return [] as BookmarkRecord[]
  }

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return [] as BookmarkRecord[]
  }
}

function writeBookmarks(bookmarks: BookmarkRecord[]) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(bookmarks))
}

export function getBookmarks() {
  return readBookmarks()
}

export function getBookmarkedSlugs() {
  return readBookmarks().map((bookmark) => bookmark.slug)
}

export function isBookmarked(slug: string) {
  return readBookmarks().some((bookmark) => bookmark.slug === slug)
}

export function addBookmark(bookmark: BookmarkRecord) {
  const bookmarks = readBookmarks().filter((entry) => entry.slug !== bookmark.slug)
  bookmarks.unshift({ ...bookmark, createdAt: bookmark.createdAt ?? new Date().toISOString() })
  writeBookmarks(bookmarks)
}

export function removeBookmark(slug: string) {
  writeBookmarks(readBookmarks().filter((bookmark) => bookmark.slug !== slug))
}

export { BOOKMARK_STORAGE_KEY }
