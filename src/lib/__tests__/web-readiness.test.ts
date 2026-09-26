import { afterEach, describe, expect, test, vi } from 'vitest'
const { transaction, databaseUrl } = vi.hoisted(() => ({ transaction: vi.fn(), databaseUrl: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { $queryRawUnsafe: transaction } }))
vi.mock('../database-url', () => ({ findDatabaseUrl: databaseUrl }))
import { parseWebReadinessConfig } from '../web-readiness-config'
import { GET as live } from '@/app/api/health/live/route'
import { GET as ready } from '@/app/api/health/ready/route'

const valid = { DATABASE_URL: 'postgresql://user:password@localhost/test', AUTH_SECRET: 'a-valid-auth-value', NEXTAUTH_SECRET: 'another-valid-value', NEXTAUTH_URL: 'http://localhost:3000', NEXT_PUBLIC_SITE_URL: 'https://site.test' }
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); vi.clearAllMocks() })
function environment() { for (const [key, value] of Object.entries(valid)) vi.stubEnv(key, value); databaseUrl.mockReturnValue(valid.DATABASE_URL) }
describe('Web readiness', () => {
  test('validates required values without disclosing them', () => {
    expect(parseWebReadinessConfig(valid).valid).toBe(true)
    for (const key of Object.keys(valid)) {
      expect(parseWebReadinessConfig({ ...valid, [key]: '' }).valid).toBe(false)
      expect(parseWebReadinessConfig({ ...valid, [key]: undefined }).valid).toBe(false)
    }
    for (const value of ['changeme', 'your-secret', 'replace-with-secret']) expect(parseWebReadinessConfig({ ...valid, AUTH_SECRET: value }).valid).toBe(false)
    for (const value of ['/relative', 'ftp://example.com', 'not-url']) expect(parseWebReadinessConfig({ ...valid, NEXTAUTH_URL: value }).valid).toBe(false)
  })
  test('live stays independent while invalid configuration skips the database', async () => {
    environment(); vi.stubEnv('AUTH_SECRET', '')
    expect((await live()).status).toBe(200)
    const response = await ready()
    expect(response.status).toBe(503)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(transaction).not.toHaveBeenCalled()
    expect(await response.json()).toEqual({ status: 'not_ready', checks: { configuration: 'failed', database: 'skipped' } })
  })
  test('returns generic results for success and database failure', async () => {
    environment(); transaction.mockResolvedValueOnce(true)
    expect((await ready()).status).toBe(200)
    transaction.mockRejectedValueOnce(new Error('secret-db-host SELECT password'))
    const response = await ready()
    expect(response.status).toBe(503)
    expect(await response.text()).not.toMatch(/secret-db-host|SELECT|password|DATABASE_URL/)
  })
  test('fails closed when configuration file resolution throws', async () => {
    environment(); databaseUrl.mockImplementationOnce(() => { throw new Error('private environment file path') })
    const response = await ready()
    expect(response.status).toBe(503)
    expect(transaction).not.toHaveBeenCalled()
    expect(await response.text()).not.toContain('private')
  })
  test('bounds both response time and outstanding probes when a database call stalls', async () => {
    environment(); vi.useFakeTimers()
    let release!: (value: boolean) => void
    transaction.mockImplementationOnce(() => new Promise<boolean>((resolve) => { release = resolve }))
    const response = ready()
    await vi.advanceTimersByTimeAsync(2000)
    expect((await response).status).toBe(503)
    expect((await ready()).status).toBe(503)
    expect(transaction).toHaveBeenCalledTimes(1)
    release(true); await vi.advanceTimersByTimeAsync(1)
  })
})
