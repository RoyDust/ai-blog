'use client'

import { useState } from 'react'

interface BookmarkButtonProps {
  slug: string
  initialBookmarked: boolean
}

export function BookmarkButton({ slug, initialBookmarked }: BookmarkButtonProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked)
  const [loading, setLoading] = useState(false)

  const handleBookmark = async () => {
    if (loading) return
    const nextValue = !bookmarked
    setBookmarked(nextValue)
    setLoading(true)
    try {
      const response = await fetch(`/api/posts/${slug}/bookmark`, {
        method: 'POST'
      })
      const data = await response.json()
      if (!data.success) {
        throw new Error('Bookmark action failed')
      }
    } catch (error) {
      setBookmarked(!nextValue)
      console.error('Bookmark error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleBookmark}
      disabled={loading}
      aria-label={bookmarked ? '取消收藏' : '收藏文章'}
      className={`ui-btn flex items-center gap-2 px-4 py-2 transition-colors ${
        bookmarked
          ? 'bg-[var(--primary)] text-white'
          : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-alt)]'
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill={bookmarked ? "currentColor" : "none"}
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="w-5 h-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z"
        />
      </svg>
      <span>{bookmarked ? '已收藏' : '收藏'}</span>
    </button>
  )
}
