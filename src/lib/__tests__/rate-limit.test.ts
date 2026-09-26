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
    process.env.RATE_LIMIT_DRIVER = originalDriver
  })

  test('blocks requests after the limit is reached', () => {
    const limiter = createMemoryRateLimiter({ limit: 1, windowMs: 60_000 })

    expect(limiter.check('ip:1').allowed).toBe(true)
    expect(limiter.check('ip:1').allowed).toBe(false)
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
