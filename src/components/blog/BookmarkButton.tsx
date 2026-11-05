'use client'

import { useEffect, useRef, useState } from 'react'
import { Bookmark } from 'lucide-react'
import { addBookmark, isBookmarked, removeBookmark } from '@/lib/bookmark-store'
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
      whileTap={reduceMotion ? undefined : { scale: 0.92 }}
      transition={springSnappy}
      className="ed-icon-btn article-action-btn disabled:cursor-wait"
      type="button"
    >
      <canvas ref={canvasRef} aria-hidden="true" className="article-action-btn__burst" />
      <motion.span
        key={bookmarked ? 'bookmarked' : 'idle'}
        variants={reduceMotion ? undefined : iconPopVariants}
        initial={reduceMotion ? false : 'hidden'}
        animate="visible"
        className="relative z-10 flex items-center"
      >
        <Bookmark aria-hidden="true" fill={bookmarked ? 'currentColor' : 'none'} strokeWidth={1.75} />
      </motion.span>
      <AnimatePresence initial={false} mode="wait">
        <motion.span
          key={bookmarked ? 'on' : 'off'}
          className="article-action-btn__label relative z-10"
          initial={reduceMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -4 }}
          transition={{ duration: 0.14 }}
        >
          {bookmarked ? '已收藏' : '收藏'}
        </motion.span>
      </AnimatePresence>
    </motion.button>
  )
}
