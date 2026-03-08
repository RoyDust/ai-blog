import { describe, expect, test } from 'vitest'

import { POSTS_SCROLL_LOAD_THRESHOLD } from '@/lib/pagination'
import { hasReachedScrollThreshold } from '../scroll-threshold'

describe('hasReachedScrollThreshold', () => {
  test(`returns true once viewport passes ${POSTS_SCROLL_LOAD_THRESHOLD * 100} percent`, () => {
    expect(
      hasReachedScrollThreshold({
        scrollTop: 200,
        clientHeight: 600,
        scrollHeight: 1000,
      }),
    ).toBe(true)
  })

  test(`returns false before ${POSTS_SCROLL_LOAD_THRESHOLD * 100} percent`, () => {
    expect(
      hasReachedScrollThreshold({
        scrollTop: 90,
        clientHeight: 600,
        scrollHeight: 1000,
      }),
    ).toBe(false)
  })
})
