import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  queryRawUnsafe: vi.fn(),
  executeRawUnsafe: vi.fn(),
  clientExecuteRawUnsafe: vi.fn(),
  getMaxStorageBytes: vi.fn(),
  getStorageStats: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: mocks.transaction,
    $executeRawUnsafe: mocks.clientExecuteRawUnsafe,
  },
}))

vi.mock('@/lib/api-operation-log-settings', () => ({
  getApiOperationLogMaxStorageBytes: mocks.getMaxStorageBytes,
  getApiOperationLogStorageStats: mocks.getStorageStats,
}))

import {
  API_LOG_RETENTION_BATCH_LIMIT,
  API_LOG_RETENTION_LOCK,
  RATE_LIMIT_RETENTION_BATCH_LIMIT,
  RATE_LIMIT_RETENTION_MAX_BATCHES,
  runApiOperationLogRetention,
  type RetentionPrismaClient,
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

  test('short-circuits log scan when storage is within maxStorageBytes and prunes expired rate_limit_entries in bounded batches outside $transaction', async () => {
    const executionOrder: string[] = []
    mocks.transaction.mockImplementationOnce(async (callback: (tx: unknown) => Promise<unknown>) => {
      executionOrder.push('tx:start')
      const res = await callback({
        $queryRawUnsafe: mocks.queryRawUnsafe,
        $executeRawUnsafe: mocks.executeRawUnsafe,
      })
      executionOrder.push('tx:end')
      return res
    })
    mocks.queryRawUnsafe.mockResolvedValueOnce([{ acquired: true }])
    mocks.clientExecuteRawUnsafe.mockImplementationOnce(async () => {
      executionOrder.push('rate-limit:batch')
      return 4
    })
    mocks.getMaxStorageBytes.mockResolvedValueOnce(10 * 1024 * 1024)
    mocks.getStorageStats.mockResolvedValueOnce({ bytes: 512 * 1024, rowCount: 42 })

    const result = await runApiOperationLogRetention('cron')

    expect(executionOrder).toEqual(['tx:start', 'tx:end', 'rate-limit:batch'])
    expect(mocks.queryRawUnsafe).toHaveBeenCalledExactlyOnceWith(
      'SELECT pg_try_advisory_xact_lock($1::int, $2::int) AS acquired',
      ...API_LOG_RETENTION_LOCK,
    )
    expect(mocks.executeRawUnsafe).not.toHaveBeenCalled()
    expect(mocks.clientExecuteRawUnsafe).toHaveBeenCalledTimes(1)
    expect(mocks.clientExecuteRawUnsafe.mock.calls[0]?.[0]).toContain('DELETE FROM "rate_limit_entries"')
    expect(mocks.clientExecuteRawUnsafe.mock.calls[0]?.[0]).toContain('LIMIT $1')
    expect(mocks.clientExecuteRawUnsafe.mock.calls[0]?.[1]).toBe(RATE_LIMIT_RETENTION_BATCH_LIMIT)
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
    mocks.clientExecuteRawUnsafe.mockResolvedValueOnce(0)
    mocks.getMaxStorageBytes.mockResolvedValueOnce(1024 * 1024)
    mocks.getStorageStats.mockResolvedValueOnce({ bytes: 1024 * 1024, rowCount: 600 })

    const result = await runApiOperationLogRetention('admin')

    expect(mocks.executeRawUnsafe).not.toHaveBeenCalled()
    expect(mocks.clientExecuteRawUnsafe).toHaveBeenCalledTimes(1)
    expect(mocks.getStorageStats).toHaveBeenCalledTimes(1)
    expect(result).toMatchObject({
      source: 'admin',
      status: 'completed',
      deletedCount: 0,
      expiredRateLimitDeletedCount: 0,
      remainingExcessBytes: 0,
    })
  })

  test('preserves log batch deletion inside $transaction and runs bounded rate_limit_entries cleanup outside $transaction', async () => {
    mocks.queryRawUnsafe.mockResolvedValueOnce([{ acquired: true }])
    mocks.executeRawUnsafe.mockResolvedValueOnce(API_LOG_RETENTION_BATCH_LIMIT)
    mocks.clientExecuteRawUnsafe
      .mockResolvedValueOnce(RATE_LIMIT_RETENTION_BATCH_LIMIT)
      .mockResolvedValueOnce(RATE_LIMIT_RETENTION_BATCH_LIMIT)
      .mockResolvedValueOnce(125)
    mocks.getMaxStorageBytes.mockResolvedValueOnce(1024 * 1024)
    mocks.getStorageStats
      .mockResolvedValueOnce({ bytes: 3 * 1024 * 1024, rowCount: 2300 })
      .mockResolvedValueOnce({ bytes: 1536 * 1024, rowCount: 1300 })

    const result = await runApiOperationLogRetention('admin')

    expect(mocks.executeRawUnsafe).toHaveBeenCalledTimes(1)
    expect(mocks.executeRawUnsafe.mock.calls[0]?.[0]).toContain('WITH sized AS')
    expect(mocks.executeRawUnsafe.mock.calls[0]?.slice(1)).toEqual([
      1024 * 1024,
      API_LOG_RETENTION_BATCH_LIMIT,
    ])
    expect(mocks.clientExecuteRawUnsafe).toHaveBeenCalledTimes(3)
    expect(mocks.getStorageStats).toHaveBeenCalledTimes(2)
    expect(result).toMatchObject({
      source: 'admin',
      status: 'more_remaining',
      maxStorageBytes: 1024 * 1024,
      batchLimit: API_LOG_RETENTION_BATCH_LIMIT,
      before: { bytes: 3 * 1024 * 1024, rowCount: 2300 },
      after: { bytes: 1536 * 1024, rowCount: 1300 },
      deletedCount: API_LOG_RETENTION_BATCH_LIMIT,
      expiredRateLimitDeletedCount: RATE_LIMIT_RETENTION_BATCH_LIMIT * 2 + 125,
      remainingExcessBytes: 512 * 1024,
    })
  })

  test('caps expired rate_limit_entries cleanup at RATE_LIMIT_RETENTION_MAX_BATCHES per run and supports tagged $executeRaw mocks', async () => {
    const taggedExecuteRaw = vi.fn().mockResolvedValue(RATE_LIMIT_RETENTION_BATCH_LIMIT)
    const customClient: RetentionPrismaClient = {
      $transaction: mocks.transaction as unknown as RetentionPrismaClient['$transaction'],
      $executeRaw: taggedExecuteRaw,
    }
    mocks.queryRawUnsafe.mockResolvedValueOnce([{ acquired: true }])
    mocks.getMaxStorageBytes.mockResolvedValueOnce(10 * 1024 * 1024)
    mocks.getStorageStats.mockResolvedValueOnce({ bytes: 128 * 1024, rowCount: 10 })

    const result = await runApiOperationLogRetention('cron', customClient)

    expect(taggedExecuteRaw).toHaveBeenCalledTimes(RATE_LIMIT_RETENTION_MAX_BATCHES)
    expect(result.expiredRateLimitDeletedCount).toBe(
      RATE_LIMIT_RETENTION_BATCH_LIMIT * RATE_LIMIT_RETENTION_MAX_BATCHES,
    )
  })

  test('skips cleanup when advisory lock is already held by another runner', async () => {
    mocks.queryRawUnsafe.mockResolvedValueOnce([{ acquired: false }])

    const result = await runApiOperationLogRetention('cron')

    expect(mocks.executeRawUnsafe).not.toHaveBeenCalled()
    expect(mocks.clientExecuteRawUnsafe).not.toHaveBeenCalled()
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
