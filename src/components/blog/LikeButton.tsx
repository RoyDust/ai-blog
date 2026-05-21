'use client'

import { useEffect, useRef, useState } from 'react'
import { Heart } from 'lucide-react'
import { getOrCreateBrowserId } from '@/lib/browser-id'
import { motion, useReducedMotion } from "motion/react";
import { springSnappy } from "@/components/motion/transitions";
import { iconPopVariants } from "@/components/motion/variants";
import { prefersReducedParticleMotion, spawnParticleBurst, type Particle } from './particle-burst'

interface LikeButtonProps {
  slug: string
  initialLiked: boolean
  initialCount: number
}

export function LikeButton({ slug, initialLiked, initialCount }: LikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
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

  const spawnParticles = (isLiked: boolean) => {
    if (prefersReducedParticleMotion(reduceMotion)) return

    spawnParticleBurst({
      animationRef,
      canvas: canvasRef.current,
      hueOffset: isLiked ? -18 : 162,
      hueOffsets: [-24, -8, 0, 18, 36],
      lightness: isLiked ? [60, 64, 58, 66, 62] : [58, 62, 66, 60, 64],
      particlesRef,
    })
  }

  const handleLike = async () => {
    if (loading) return
    const nextLiked = !liked
    const nextCount = nextLiked ? count + 1 : count - 1
    setLiked(nextLiked)
    setCount(nextCount)
    setLoading(true)

    spawnParticles(nextLiked)

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
    <motion.button
      onClick={handleLike}
      disabled={loading}
      aria-label={liked ? '取消点赞' : '点赞'}
      whileTap={{ scale: 0.92 }}
      whileFocus={{ scale: 0.96 }}
      transition={springSnappy}
      className={`relative inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-60 ${
        liked
          ? 'border-[color:color-mix(in_oklab,var(--accent-warm)_60%,var(--reader-border))] bg-[color-mix(in_oklab,var(--accent-warm)_24%,var(--reader-panel))] text-[var(--foreground)]'
          : 'border-[var(--reader-border)] bg-[color-mix(in_oklab,var(--reader-panel-elevated)_82%,transparent)] text-[var(--text-body)] hover:border-[var(--reader-border-strong)] hover:bg-[var(--reader-panel-elevated)] hover:text-[var(--foreground)]'
      }`}
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute left-1/2 top-1/2 h-[120px] w-[120px] -translate-x-1/2 -translate-y-1/2 overflow-visible"
      />
      <motion.span
        key={liked ? 'liked' : 'idle'}
        variants={iconPopVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 flex items-center"
      >
        <Heart className="h-5 w-5" fill={liked ? 'currentColor' : 'none'} />
      </motion.span>
      <span className="relative z-10">{count}</span>
    </motion.button>
  )
}
