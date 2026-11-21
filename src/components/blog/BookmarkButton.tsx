'use client'

import { useEffect, useRef, useState } from 'react'
import { Bookmark } from 'lucide-react'
import { addBookmark, isBookmarked, removeBookmark } from '@/lib/bookmark-store'
import { motion, useReducedMotion } from "motion/react";
import { springSnappy } from "@/components/motion/transitions";
import { iconPopVariants } from "@/components/motion/variants";
import { prefersReducedParticleMotion, spawnParticleBurst, type Particle } from './particle-burst'

interface BookmarkButtonProps {
  slug: string
  initialBookmarked: boolean
  title: string
  excerpt?: string | null
}

export function BookmarkButton({ slug, initialBookmarked, title, excerpt }: BookmarkButtonProps) {
  const [bookmarked, setBookmarked] = useState(() => isBookmarked(slug) || initialBookmarked)
  const [loading, setLoading] = useState(false)
  const reduceMotion = useReducedMotion()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const animationRef = useRef<number | null>(null)

  useEffect(() => {
    const animation = animationRef

    return () => {
      if (animation.current) {
        cancelAnimationFrame(animation.current)
      }
    }
  }, [])

  const spawnParticles = (isBookmarked: boolean) => {
    if (prefersReducedParticleMotion(reduceMotion)) return

    spawnParticleBurst({
      animationRef,
      canvas: canvasRef.current,
      hueOffset: isBookmarked ? 24 : 168,
      hueOffsets: [-28, -10, 0, 20, 40],
      lightness: isBookmarked ? [58, 62, 66, 60, 64] : [60, 64, 58, 66, 62],
      particlesRef,
    })
  }

  const handleBookmark = async () => {
    if (loading) return

    const nextValue = !bookmarked
    setBookmarked(nextValue)
    setLoading(true)

    spawnParticles(nextValue)

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
      className={`relative inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60 ${
        bookmarked
          ? 'border-[color:color-mix(in_oklab,var(--accent-sky)_55%,var(--reader-border))] bg-[color-mix(in_oklab,var(--accent-sky)_22%,var(--reader-panel))] text-[var(--foreground)]'
          : 'border-[var(--reader-border)] bg-[color-mix(in_oklab,var(--reader-panel-elevated)_82%,transparent)] text-[var(--text-body)] hover:border-[var(--reader-border-strong)] hover:bg-[var(--reader-panel-elevated)] hover:text-[var(--foreground)]'
      }`}
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute left-1/2 top-1/2 h-[120px] w-[120px] -translate-x-1/2 -translate-y-1/2 overflow-visible"
      />
      <motion.span
        key={bookmarked ? 'bookmarked' : 'idle'}
        variants={iconPopVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 flex items-center"
      >
        <Bookmark className="h-5 w-5" fill={bookmarked ? 'currentColor' : 'none'} />
      </motion.span>
      <span className="relative z-10">{bookmarked ? '已收藏' : '收藏'}</span>
    </motion.button>
  )
}
