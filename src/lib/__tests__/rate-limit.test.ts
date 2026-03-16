import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const queryRawUnsafe = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRawUnsafe: queryRawUnsafe,
    $executeRawUnsafe: vi.fn(),
  },
}))

import { checkInteractionRateLimit, createMemoryRateLimiter } from '../rate-limit'

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
})
