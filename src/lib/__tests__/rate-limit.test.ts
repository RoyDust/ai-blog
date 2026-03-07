import { describe, expect, test } from 'vitest'
import { createMemoryRateLimiter } from '../rate-limit'

describe('rate limiter', () => {
  test('blocks requests after the limit is reached', () => {
    const limiter = createMemoryRateLimiter({ limit: 1, windowMs: 60_000 })

    expect(limiter.check('ip:1').allowed).toBe(true)
    expect(limiter.check('ip:1').allowed).toBe(false)
  })
})
