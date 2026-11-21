import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  queryRawUnsafe: vi.fn(),
  executeRawUnsafe: vi.fn(),
  getMaxStorageBytes: vi.fn(),
  getStorageStats: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}))

vi.mock('@/lib/api-operation-log-settings', () => ({
  getApiOperationLogMaxStorageBytes: mocks.getMaxStorageBytes,
  getApiOperationLogStorageStats: mocks.getStorageStats,
}))

import {
  API_LOG_RETENTION_BATCH_LIMIT,
  API_LOG_RETENTION_LOCK,
  runApiOperationLogRetention,
} from '../api-operation-log-retention'

describe('runApiOperationLogRetention', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    mocks.transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        $queryRawUnsafe: mocks.queryRawUnsafe,
        $executeRawUnsafe: mocks.executeRawUnsafe,
      }),
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('short-circuits log scan and second stats query when storage is within maxStorageBytes while pruning expired rate_limit_entries', async () => {
    mocks.queryRawUnsafe.mockResolvedValueOnce([{ acquired: true }])
    mocks.executeRawUnsafe.mockResolvedValueOnce(4)
    mocks.getMaxStorageBytes.mockResolvedValueOnce(10 * 1024 * 1024)
    mocks.getStorageStats.mockResolvedValueOnce({ bytes: 512 * 1024, rowCount: 42 })

    const result = await runApiOperationLogRetention('cron')

    expect(mocks.queryRawUnsafe).toHaveBeenCalledExactlyOnceWith(
      'SELECT pg_try_advisory_xact_lock($1::int, $2::int) AS acquired',
      ...API_LOG_RETENTION_LOCK,
    )
    expect(mocks.executeRawUnsafe).toHaveBeenCalledExactlyOnceWith(
      'DELETE FROM "rate_limit_entries" WHERE "reset_at" <= NOW()',
    )
    expect(
      mocks.executeRawUnsafe.mock.calls.some(([sql]) => typeof sql === 'string' && sql.includes('WITH sized AS')),
    ).toBe(false)
    expect(mocks.getStorageStats).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      source: 'cron',
      status: 'completed',
      maxStorageBytes: 10 * 1024 * 1024,
      batchLimit: API_LOG_RETENTION_BATCH_LIMIT,
      before: { bytes: 512 * 1024, rowCount: 42 },
      after: { bytes: 512 * 1024, rowCount: 42 },
      deletedCount: 0,
      expiredRateLimitDeletedCount: 4,
      remainingExcessBytes: 0,
    })
  })

  test('also short-circuits when before.bytes equals maxStorageBytes exactly', async () => {
    mocks.queryRawUnsafe.mockResolvedValueOnce([{ acquired: true }])
    mocks.executeRawUnsafe.mockResolvedValueOnce(0)
    mocks.getMaxStorageBytes.mockResolvedValueOnce(1024 * 1024)
    mocks.getStorageStats.mockResolvedValueOnce({ bytes: 1024 * 1024, rowCount: 600 })

    const result = await runApiOperationLogRetention('admin')

    expect(mocks.executeRawUnsafe).toHaveBeenCalledTimes(1)
    expect(mocks.getStorageStats).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      source: 'admin',
      status: 'completed',
      deletedCount: 0,
      expiredRateLimitDeletedCount: 0,
      remainingExcessBytes: 0,
    })
  })

  test('preserves batch deletion and reports remaining excess when storage exceeds maxStorageBytes', async () => {
    mocks.queryRawUnsafe.mockResolvedValueOnce([{ acquired: true }])
    mocks.executeRawUnsafe
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(API_LOG_RETENTION_BATCH_LIMIT)
    mocks.getMaxStorageBytes.mockResolvedValueOnce(1024 * 1024)
    mocks.getStorageStats
      .mockResolvedValueOnce({ bytes: 3 * 1024 * 1024, rowCount: 2300 })
      .mockResolvedValueOnce({ bytes: 1536 * 1024, rowCount: 1300 })

    const result = await runApiOperationLogRetention('admin')

    expect(mocks.executeRawUnsafe).toHaveBeenCalledTimes(2)
    expect(mocks.executeRawUnsafe.mock.calls[0]?.[0]).toBe(
      'DELETE FROM "rate_limit_entries" WHERE "reset_at" <= NOW()',
    )
    expect(mocks.executeRawUnsafe.mock.calls[1]?.[0]).toContain('WITH sized AS')
    expect(mocks.executeRawUnsafe.mock.calls[1]?.slice(1)).toEqual([
      1024 * 1024,
      API_LOG_RETENTION_BATCH_LIMIT,
    ])
    expect(mocks.getStorageStats).toHaveBeenCalledTimes(2)
    expect(result).toMatchObject({
      source: 'admin',
      status: 'more_remaining',
      maxStorageBytes: 1024 * 1024,
      batchLimit: API_LOG_RETENTION_BATCH_LIMIT,
      before: { bytes: 3 * 1024 * 1024, rowCount: 2300 },
      after: { bytes: 1536 * 1024, rowCount: 1300 },
      deletedCount: API_LOG_RETENTION_BATCH_LIMIT,
      expiredRateLimitDeletedCount: 2,
      remainingExcessBytes: 512 * 1024,
    })
  })

  test('skips cleanup when advisory lock is already held by another runner', async () => {
    mocks.queryRawUnsafe.mockResolvedValueOnce([{ acquired: false }])

    const result = await runApiOperationLogRetention('cron')

    expect(mocks.executeRawUnsafe).not.toHaveBeenCalled()
    expect(mocks.getMaxStorageBytes).not.toHaveBeenCalled()
    expect(mocks.getStorageStats).not.toHaveBeenCalled()
    expect(result).toMatchObject({
      source: 'cron',
      status: 'skipped_locked',
      maxStorageBytes: null,
      before: null,
      after: null,
      deletedCount: 0,
      expiredRateLimitDeletedCount: 0,
      remainingExcessBytes: null,
    })
  })
})
