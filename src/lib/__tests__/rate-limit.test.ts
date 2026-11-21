import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const queryRawUnsafe = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRawUnsafe: queryRawUnsafe,
  },
}))

import { checkAuthRateLimit, checkInteractionRateLimit, createMemoryRateLimiter } from '../rate-limit'

describe('rate limiter', () => {
  const originalDriver = process.env.RATE_LIMIT_DRIVER

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RATE_LIMIT_DRIVER = originalDriver
  })

  afterEach(() => {
    vi.useRealTimers()
    process.env.RATE_LIMIT_DRIVER = originalDriver
  })

  test('blocks requests after the limit is reached', () => {
    const limiter = createMemoryRateLimiter({ limit: 1, windowMs: 60_000 })

    expect(limiter.check('ip:1').allowed).toBe(true)
    expect(limiter.check('ip:1').allowed).toBe(false)
  })

  test('lazily sweeps expired entries when subsequent checks arrive', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T00:00:00.000Z'))

    const limiter = createMemoryRateLimiter({ limit: 1, windowMs: 1_000, maxEntries: 10 })
    expect(limiter.check('ip:1').allowed).toBe(true)
    expect(limiter.check('ip:2').allowed).toBe(true)
    expect(limiter.size).toBe(2)

    vi.advanceTimersByTime(1_001)

    expect(limiter.check('ip:3').allowed).toBe(true)
    expect(limiter.size).toBe(1)
    expect(limiter.check('ip:1').allowed).toBe(true)
  })

  test('caps in-memory keys at maxEntries by sweeping expired keys first and evicting oldest active keys', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-01T00:00:00.000Z'))

    const limiter = createMemoryRateLimiter({ limit: 1, windowMs: 10_000, maxEntries: 3 })
    expect(limiter.check('ip:1').allowed).toBe(true)

    vi.advanceTimersByTime(5_000)
    expect(limiter.check('ip:2').allowed).toBe(true)
    expect(limiter.check('ip:3').allowed).toBe(true)
    expect(limiter.size).toBe(3)

    // Advance so ip:1 is expired (11s > 10s), while ip:2 and ip:3 are still active (6s < 10s).
    vi.advanceTimersByTime(6_000)
    expect(limiter.check('ip:4').allowed).toBe(true)
    expect(limiter.size).toBe(3)
    // ip:2 was NOT evicted because expired ip:1 was swept first.
    expect(limiter.check('ip:2').allowed).toBe(false)

    // Now ip:2, ip:3, ip:4 are all active; inserting ip:5 evicts the oldest active key (ip:2).
    expect(limiter.check('ip:5').allowed).toBe(true)
    expect(limiter.size).toBe(3)
    expect(limiter.check('ip:3').allowed).toBe(false)
    expect(limiter.check('ip:4').allowed).toBe(false)
    expect(limiter.check('ip:2').allowed).toBe(true)
    expect(limiter.size).toBe(3)
  })

  test('uses the database-backed limiter path when RATE_LIMIT_DRIVER=database', async () => {
    process.env.RATE_LIMIT_DRIVER = 'database'
    queryRawUnsafe.mockResolvedValueOnce([{ count: 1, reset_at: new Date('2026-03-17T00:00:00.000Z') }])

    const result = await checkInteractionRateLimit(
      new Request('http://localhost/api/comments', {
        headers: { 'x-forwarded-for': '203.0.113.42' },
      }),
    )

    expect(queryRawUnsafe).toHaveBeenCalledOnce()
    expect(result).toMatchObject({
      allowed: true,
      remaining: 19,
      strategy: 'database',
    })
  })

  test('cannot rotate a forged forwarded-for prefix to evade the trusted proxy IP limit', async () => {
    process.env.RATE_LIMIT_DRIVER = 'memory'
    const results = []
    for (let attempt = 0; attempt < 6; attempt += 1) {
      results.push(await checkAuthRateLimit(new Request('http://localhost/api/auth/callback/credentials', {
        headers: {
          'x-real-ip': '203.0.113.80',
          'x-forwarded-for': `198.51.100.${attempt + 1}, 203.0.113.80`,
        },
      })))
    }

    expect(results.map((result) => result.allowed)).toEqual([true, true, true, true, true, false])
  })
})
