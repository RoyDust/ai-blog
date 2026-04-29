'use client'

import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
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
      className={`inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60 ${
        liked
          ? 'border-[color:color-mix(in_oklab,var(--accent-warm)_60%,var(--reader-border))] bg-[color-mix(in_oklab,var(--accent-warm)_24%,var(--reader-panel))] text-[var(--foreground)]'
          : 'border-[var(--reader-border)] bg-[color-mix(in_oklab,var(--reader-panel-elevated)_82%,transparent)] text-[var(--text-body)] hover:border-[var(--reader-border-strong)] hover:bg-[var(--reader-panel-elevated)] hover:text-[var(--foreground)]'
      }`}
    >
      <Heart className="h-5 w-5" fill={liked ? 'currentColor' : 'none'} />
      <span>{count}</span>
    </button>
  )
}
