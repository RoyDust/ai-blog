import type { CSSProperties } from 'react'

const MAX_ANIMATED_ITEMS = 4
const BASE_DELAY_MS = 100
const DELAY_STEP_MS = 50

export function getListRevealAnimationProps(index: number): {
  className?: string
  style?: CSSProperties
} {
  if (index >= MAX_ANIMATED_ITEMS) {
    return {}
  }

  return {
    className: 'onload-animation',
    style: { animationDelay: `${BASE_DELAY_MS + index * DELAY_STEP_MS}ms` },
  }
}

