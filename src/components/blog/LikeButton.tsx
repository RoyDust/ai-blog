'use client'

import { useEffect, useState } from 'react'
import { getOrCreateBrowserId } from '@/lib/browser-id'

interface LikeButtonProps {
  slug: string
  initialLiked: boolean
  initialCount: number
}

export function LikeButton({ slug, initialLiked, initialCount }: LikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true

    async function syncLikeState() {
      try {
        const browserId = getOrCreateBrowserId()
        const response = await fetch(`/api/posts/${slug}/like`, {
          headers: { 'x-browser-id': browserId },
        })
        const data = await response.json()

        if (!active || !response.ok || !data.success) return

        setLiked(Boolean(data.data?.liked))
        setCount(typeof data.data?.count === 'number' ? data.data.count : initialCount)
      } catch {
        return
      }
    }

    void syncLikeState()

    return () => {
      active = false
    }
  }, [initialCount, slug])

  const handleLike = async () => {
    if (loading) return
    const nextLiked = !liked
    const nextCount = nextLiked ? count + 1 : count - 1
    setLiked(nextLiked)
    setCount(nextCount)
    setLoading(true)

    try {
      const browserId = getOrCreateBrowserId()
      const response = await fetch(`/api/posts/${slug}/like`, {
        method: 'POST',
        headers: { 'x-browser-id': browserId },
      })
      const data = await response.json()

      if (!data.success) {
        throw new Error('Like action failed')
      }
    } catch (error) {
      setLiked(!nextLiked)
      setCount(count)
      console.error('Like error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleLike}
      disabled={loading}
      aria-label={liked ? '取消点赞' : '点赞'}
      className={`ui-btn flex items-center gap-2 px-4 py-2 transition-colors ${
        liked
          ? 'bg-rose-500 text-white'
          : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-alt)]'
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill={liked ? 'currentColor' : 'none'}
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className="h-5 w-5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
        />
      </svg>
      <span>{count}</span>
    </button>
  )
}
