'use client'

import { useEffect, useRef, useState } from 'react'
import { Heart } from 'lucide-react'
import { getOrCreateBrowserId } from '@/lib/browser-id'
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
      whileTap={reduceMotion ? undefined : { scale: 0.92 }}
      transition={springSnappy}
      className="ed-icon-btn article-action-btn disabled:cursor-wait"
      type="button"
    >
      <canvas ref={canvasRef} aria-hidden="true" className="article-action-btn__burst" />
      <motion.span
        key={liked ? 'liked' : 'idle'}
        variants={reduceMotion ? undefined : iconPopVariants}
        initial={reduceMotion ? false : 'hidden'}
        animate="visible"
        className="relative z-10 flex items-center"
      >
        <Heart aria-hidden="true" fill={liked ? 'currentColor' : 'none'} strokeWidth={1.75} />
      </motion.span>
      <AnimatedCount value={count} />
    </motion.button>
  )
}

/** 等宽计数：数字变化时上下滚动换位（点赞 +1 向上、取消向下） */
export function AnimatedCount({ value }: { value: number }) {
  const reduceMotion = useReducedMotion()
  const [previous, setPrevious] = useState(value)
  const [direction, setDirection] = useState(1)

  // 渲染期调整：记录变化方向，不在 effect 里 setState
  if (value !== previous) {
    setDirection(value > previous ? 1 : -1)
    setPrevious(value)
  }

  return (
    <span className="article-action-btn__count relative z-10">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          initial={reduceMotion ? false : { y: direction * 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduceMotion ? undefined : { y: direction * -10, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
