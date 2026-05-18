'use client'

import { useState } from 'react'
import { Bookmark } from 'lucide-react'
import { addBookmark, isBookmarked, removeBookmark } from '@/lib/bookmark-store'
import { motion } from "motion/react";
import { springSnappy } from "@/components/motion/transitions";
import { iconPopVariants } from "@/components/motion/variants";

interface BookmarkButtonProps {
  slug: string
  initialBookmarked: boolean
  title: string
  excerpt?: string | null
}

export function BookmarkButton({ slug, initialBookmarked, title, excerpt }: BookmarkButtonProps) {
  const [bookmarked, setBookmarked] = useState(() => isBookmarked(slug) || initialBookmarked)
  const [loading, setLoading] = useState(false)

  const handleBookmark = async () => {
    if (loading) return

    const nextValue = !bookmarked
    setBookmarked(nextValue)
    setLoading(true)

    try {
      if (nextValue) {
        addBookmark({ slug, title, excerpt: excerpt ?? undefined })
      } else {
        removeBookmark(slug)
      }

      window.dispatchEvent(new CustomEvent('bookmarks:changed'))
    } catch (error) {
      setBookmarked(!nextValue)
      console.error('Bookmark error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.button
      onClick={handleBookmark}
      disabled={loading}
      aria-label={bookmarked ? '已收藏' : '收藏文章'}
      whileTap={{ scale: 0.92 }}
      whileFocus={{ scale: 0.96 }}
      transition={springSnappy}
      className={`inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60 ${
        bookmarked
          ? 'border-[color:color-mix(in_oklab,var(--accent-sky)_55%,var(--reader-border))] bg-[color-mix(in_oklab,var(--accent-sky)_22%,var(--reader-panel))] text-[var(--foreground)]'
          : 'border-[var(--reader-border)] bg-[color-mix(in_oklab,var(--reader-panel-elevated)_82%,transparent)] text-[var(--text-body)] hover:border-[var(--reader-border-strong)] hover:bg-[var(--reader-panel-elevated)] hover:text-[var(--foreground)]'
      }`}
    >
      <motion.span
        key={bookmarked ? 'bookmarked' : 'idle'}
        variants={iconPopVariants}
        initial="hidden"
        animate="visible"
      >
        <Bookmark className="h-5 w-5" fill={bookmarked ? 'currentColor' : 'none'} />
      </motion.span>
      <span>{bookmarked ? '已收藏' : '收藏'}</span>
    </motion.button>
  )
}
