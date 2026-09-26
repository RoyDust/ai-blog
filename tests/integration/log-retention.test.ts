import { randomBytes, randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { runApiOperationLogRetention } from '@/lib/api-operation-log-retention'
import { getApiOperationLogStorageStats, updateApiOperationLogMaxStorageBytes } from '@/lib/api-operation-log-settings'
import { withApiOperationLogging } from '@/lib/api-operation-log-route'

const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL })
const settingKey = 'apiOperationLog.maxStorageBytes'
let prefix: string
let original: { value: unknown } | null
beforeEach(async () => {
  prefix = 'retention-' + randomUUID()
  expect(await prisma.apiOperationLog.count()).toBe(0)
  original = await prisma.systemSetting.findUnique({ where: { key: settingKey }, select: { value: true } })
  await updateApiOperationLogMaxStorageBytes('1m')
})
afterEach(async () => {
  await pool.query('DROP TRIGGER IF EXISTS p2_log_delete_fault ON api_operation_logs')
  await pool.query('DROP FUNCTION IF EXISTS p2_log_delete_fault()')
  await prisma.apiOperationLog.deleteMany({ where: { requestId: { startsWith: prefix } } })
  if (original) await pool.query('UPDATE system_settings SET value = $1::jsonb WHERE key = $2', [JSON.stringify(original.value), settingKey])
  else await prisma.systemSetting.deleteMany({ where: { key: settingKey } })
  vi.unstubAllEnvs()
})
afterAll(async () => { await pool.end(); await prisma.$disconnect() })
async function seed(count: number) {
  await prisma.apiOperationLog.createMany({ data: Array.from({ length: count }, (_, n) => ({
    id: prefix + '-' + String(n).padStart(5, '0'), requestId: prefix + '-' + n,
    method: 'GET', path: '/fixture', scope: 'public', success: true,
    createdAt: new Date(Date.UTC(2020, 0, 1) + Math.floor(n / 5) * 1000),
    requestBody: { payload: randomBytes(800 + n % 150).toString('hex') },
  })) })
}
describe('bounded log retention in PostgreSQL', () => {
  test('wrapped requests and saving settings keep old rows even when storage exceeds the limit', async () => {
    await seed(900)
    vi.stubEnv('API_OPERATION_LOG_TEST_ENABLE', '1')
    const route = withApiOperationLogging(async () => Response.json({ ok: true }), { scope: 'public', route: '/fixture' })
    const response = await route(new Request('http://localhost/fixture', { headers: { 'x-request-id': prefix + '-request' } }))
    expect(response.status).toBe(200)
    expect(await prisma.apiOperationLog.count()).toBe(901)
    expect((await getApiOperationLogStorageStats()).bytes).toBeGreaterThan(1024 * 1024)
    expect((await updateApiOperationLogMaxStorageBytes('1m')).deletedCount).toBe(0)
    expect(await prisma.apiOperationLog.count()).toBe(901)
  })
  test('deletes at most 1000 oldest excess rows and converges to the newest byte-bounded set', async () => {
    await seed(2300)
    const rows = await pool.query<{ id: string; size: number }>('SELECT id, pg_column_size(logs.*) AS size FROM api_operation_logs logs ORDER BY "createdAt" DESC, id DESC')
    let bytes = 0
    const expected: string[] = []
    for (const row of rows.rows) { bytes += row.size; if (bytes <= 1024 * 1024) expected.push(row.id) }
    const first = await runApiOperationLogRetention('admin')
    expect(first.status).toBe('more_remaining')
    expect(first.deletedCount).toBe(1000)
    expect(first.before?.rowCount).toBe(2300)
    expect(first.after?.rowCount).toBe(1300)
    expect(await prisma.apiOperationLog.findUnique({ where: { id: prefix + '-00000' } })).toBeNull()
    expect(await prisma.apiOperationLog.findUnique({ where: { id: prefix + '-00999' } })).toBeNull()
    expect(await prisma.apiOperationLog.findUnique({ where: { id: prefix + '-01000' } })).not.toBeNull()
    const last = await runApiOperationLogRetention('cron')
    expect(last.status).toBe('completed')
    expect(last.after?.bytes).toBeLessThanOrEqual(1024 * 1024)
    expect(new Set((await prisma.apiOperationLog.findMany({ select: { id: true } })).map((r) => r.id))).toEqual(new Set(expected))
    expect((await runApiOperationLogRetention('admin')).deletedCount).toBe(0)
  })
  test('a competing runner skips while the first is blocked holding its transaction lock', async () => {
    await seed(900)
    const blocker = await pool.connect()
    let first: Promise<Awaited<ReturnType<typeof runApiOperationLogRetention>>> | undefined
    try {
      await blocker.query('BEGIN'); await blocker.query('LOCK TABLE api_operation_logs IN ACCESS EXCLUSIVE MODE')
      first = runApiOperationLogRetention('admin')
      const deadline = Date.now() + 5000
      while (true) {
        const held = await pool.query("SELECT 1 FROM pg_locks WHERE locktype = 'advisory' AND classid = 21199 AND objid = 2 AND granted")
        if (held.rowCount) break
        if (Date.now() > deadline) throw new Error('runner did not acquire its transaction advisory lock')
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
      expect(await runApiOperationLogRetention('cron')).toMatchObject({ status: 'skipped_locked', before: null, after: null, deletedCount: 0 })
    } finally { await blocker.query('ROLLBACK'); blocker.release() }
    expect((await first!).status).toBe('completed')
  })
  test('delete failure rolls back and releases the lock so a later run succeeds', async () => {
    await seed(900)
    await pool.query("CREATE FUNCTION p2_log_delete_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected'; END $$")
    await pool.query('CREATE TRIGGER p2_log_delete_fault BEFORE DELETE ON api_operation_logs FOR EACH ROW EXECUTE FUNCTION p2_log_delete_fault()')
    await expect(runApiOperationLogRetention('admin')).rejects.toThrow()
    expect(await prisma.apiOperationLog.count()).toBe(900)
    await pool.query('DROP TRIGGER p2_log_delete_fault ON api_operation_logs')
    expect((await runApiOperationLogRetention('cron')).status).toBe('completed')
  })
})
