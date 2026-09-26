import { prisma } from '@/lib/prisma'
import { getApiOperationLogMaxStorageBytes, getApiOperationLogStorageStats } from '@/lib/api-operation-log-settings'

export const API_LOG_RETENTION_BATCH_LIMIT = 1000
export const API_LOG_RETENTION_LOCK = [21199, 2] as const

export async function runApiOperationLogRetention(source: 'cron' | 'admin') {
  const startedAt = Date.now()
  try {
    const result = await prisma.$transaction(async (tx) => {
      const [lock] = await tx.$queryRawUnsafe<Array<{ acquired: boolean }>>(
        'SELECT pg_try_advisory_xact_lock($1::int, $2::int) AS acquired', ...API_LOG_RETENTION_LOCK,
      )
      if (!lock.acquired) return {
        source, status: 'skipped_locked' as const, maxStorageBytes: null, batchLimit: API_LOG_RETENTION_BATCH_LIMIT,
        before: null, after: null, deletedCount: 0, remainingExcessBytes: null,
      }
      const maxStorageBytes = await getApiOperationLogMaxStorageBytes(tx)
      const before = await getApiOperationLogStorageStats(tx)
      const deletedCount = await tx.$executeRawUnsafe(`
        WITH sized AS (
          SELECT "id", "createdAt", pg_column_size(logs.*)::bigint AS row_size FROM "api_operation_logs" logs
        ), ranked AS (
          SELECT "id", "createdAt", SUM(row_size) OVER (ORDER BY "createdAt" DESC, "id" DESC) AS newest_bytes FROM sized
        ), candidates AS (
          SELECT "id" FROM ranked WHERE newest_bytes > $1 ORDER BY "createdAt" ASC, "id" ASC LIMIT $2
        )
        DELETE FROM "api_operation_logs" WHERE "id" IN (SELECT "id" FROM candidates)
      `, maxStorageBytes, API_LOG_RETENTION_BATCH_LIMIT)
      const after = await getApiOperationLogStorageStats(tx)
      return {
        source, status: after.bytes <= maxStorageBytes ? 'completed' as const : 'more_remaining' as const,
        maxStorageBytes, batchLimit: API_LOG_RETENTION_BATCH_LIMIT, before, after, deletedCount,
        remainingExcessBytes: Math.max(0, after.bytes - maxStorageBytes),
      }
    }, { maxWait: 2000, timeout: 30000 })
    const response = { ...result, durationMs: Date.now() - startedAt }
    console.info('api_operation_log_retention', response)
    return response
  } catch (error) {
    console.error('api_operation_log_retention_failed', { source, durationMs: Date.now() - startedAt })
    throw error
  }
}
