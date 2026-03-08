import { POSTS_SCROLL_LOAD_THRESHOLD } from '@/lib/pagination'

interface ScrollThresholdInput {
  scrollTop: number
  clientHeight: number
  scrollHeight: number
  threshold?: number
}

export function hasReachedScrollThreshold({
  scrollTop,
  clientHeight,
  scrollHeight,
  threshold = POSTS_SCROLL_LOAD_THRESHOLD,
}: ScrollThresholdInput) {
  if (scrollHeight <= 0 || clientHeight <= 0) {
    return false
  }

  return (scrollTop + clientHeight) / scrollHeight >= threshold
}
