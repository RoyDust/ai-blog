import { prisma } from '@/lib/prisma'
import { getApiOperationLogMaxStorageBytes, getApiOperationLogStorageStats } from '@/lib/api-operation-log-settings'

export const API_LOG_RETENTION_BATCH_LIMIT = 1000
export const API_LOG_RETENTION_LOCK = [21199, 2] as const
export const RATE_LIMIT_RETENTION_BATCH_LIMIT = 5000
export const RATE_LIMIT_RETENTION_MAX_BATCHES = 20

const DELETE_EXPIRED_RATE_LIMIT_BATCH_SQL = `
  DELETE FROM "rate_limit_entries"
  WHERE "key" IN (
    SELECT "key"
    FROM "rate_limit_entries"
    WHERE "reset_at" <= NOW()
    ORDER BY "reset_at" ASC
    LIMIT $1
  )
`

type RawBatchExecutor = {
  $executeRawUnsafe?: (query: string, ...values: unknown[]) => Promise<number | bigint>
  $executeRaw?: (query: TemplateStringsArray, ...values: unknown[]) => Promise<number | bigint>
}

export type RetentionPrismaClient = RawBatchExecutor & {
  $transaction: typeof prisma.$transaction
}

async function executeExpiredRateLimitBatchDelete(
  executor: RawBatchExecutor,
  batchLimit: number,
): Promise<number> {
  if (typeof executor.$executeRawUnsafe === 'function') {
    return Number(await executor.$executeRawUnsafe(DELETE_EXPIRED_RATE_LIMIT_BATCH_SQL, batchLimit))
  }
  if (typeof executor.$executeRaw === 'function') {
    return Number(
      await executor.$executeRaw`
        DELETE FROM "rate_limit_entries"
        WHERE "key" IN (
          SELECT "key"
          FROM "rate_limit_entries"
          WHERE "reset_at" <= NOW()
          ORDER BY "reset_at" ASC
          LIMIT ${batchLimit}
        )
      `,
    )
  }
  return 0
}

export async function pruneExpiredRateLimitEntries(
  executor: RawBatchExecutor = prisma,
  {
    batchLimit = RATE_LIMIT_RETENTION_BATCH_LIMIT,
    maxBatches = RATE_LIMIT_RETENTION_MAX_BATCHES,
  }: {
    batchLimit?: number
    maxBatches?: number
  } = {},
): Promise<number> {
  let totalDeleted = 0
  for (let batch = 0; batch < maxBatches; batch += 1) {
    const deleted = await executeExpiredRateLimitBatchDelete(executor, batchLimit)
    totalDeleted += deleted
    if (deleted < batchLimit) {
      break
    }
  }
  return totalDeleted
}

export async function runApiOperationLogRetention(
  source: 'cron' | 'admin',
  client: RetentionPrismaClient = prisma,
) {
  const startedAt = Date.now()
  try {
    let fallbackRateLimitExecutor: RawBatchExecutor | null = null
    const txResult = await client.$transaction(async (tx) => {
      fallbackRateLimitExecutor = tx as unknown as RawBatchExecutor
      const [lock] = await tx.$queryRawUnsafe<Array<{ acquired: boolean }>>(
        'SELECT pg_try_advisory_xact_lock($1::int, $2::int) AS acquired', ...API_LOG_RETENTION_LOCK,
      )
      if (!lock?.acquired) return {
        source, status: 'skipped_locked' as const, maxStorageBytes: null, batchLimit: API_LOG_RETENTION_BATCH_LIMIT,
        before: null, after: null, deletedCount: 0, remainingExcessBytes: null,
      }
      const maxStorageBytes = await getApiOperationLogMaxStorageBytes(tx)
      const before = await getApiOperationLogStorageStats(tx)
      if (before.bytes <= maxStorageBytes) {
        return {
          source,
          status: 'completed' as const,
          maxStorageBytes,
          batchLimit: API_LOG_RETENTION_BATCH_LIMIT,
          before,
          after: before,
          deletedCount: 0,
          remainingExcessBytes: 0,
        }
      }
      const deletedCount = Number(await tx.$executeRawUnsafe(`
        WITH sized AS (
          SELECT "id", "createdAt", pg_column_size(logs.*)::bigint AS row_size FROM "api_operation_logs" logs
        ), ranked AS (
          SELECT "id", "createdAt", SUM(row_size) OVER (ORDER BY "createdAt" DESC, "id" DESC) AS newest_bytes FROM sized
        ), candidates AS (
          SELECT "id" FROM ranked WHERE newest_bytes > $1 ORDER BY "createdAt" ASC, "id" ASC LIMIT $2
        )
        DELETE FROM "api_operation_logs" WHERE "id" IN (SELECT "id" FROM candidates)
      `, maxStorageBytes, API_LOG_RETENTION_BATCH_LIMIT))
      const after = await getApiOperationLogStorageStats(tx)
      return {
        source, status: after.bytes <= maxStorageBytes ? 'completed' as const : 'more_remaining' as const,
        maxStorageBytes, batchLimit: API_LOG_RETENTION_BATCH_LIMIT, before, after, deletedCount,
        remainingExcessBytes: Math.max(0, after.bytes - maxStorageBytes),
      }
    }, { maxWait: 2000, timeout: 30000 })

    // Run bounded rate-limit cleanup outside the interactive transaction so a large
    // rate_limit_entries backlog cannot exceed the 30s transaction timeout or roll back log retention.
    const rateLimitExecutor =
      typeof client.$executeRawUnsafe === 'function' || typeof client.$executeRaw === 'function'
        ? client
        : (fallbackRateLimitExecutor ?? client)
    const expiredRateLimitDeletedCount =
      txResult.status === 'skipped_locked' ? 0 : await pruneExpiredRateLimitEntries(rateLimitExecutor)

    const response = {
      ...txResult,
      expiredRateLimitDeletedCount,
      durationMs: Date.now() - startedAt,
    }
    console.info('api_operation_log_retention', response)
    return response
  } catch (error) {
    console.error('api_operation_log_retention_failed', { source, durationMs: Date.now() - startedAt })
    throw error
  }
}
