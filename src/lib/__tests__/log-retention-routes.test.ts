import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { ForbiddenError, UnauthorizedError } from '@/lib/api-errors'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), run: vi.fn() }))
vi.mock('@/lib/api-auth', () => ({ requireAdminSession: mocks.auth }))
vi.mock('@/lib/api-operation-log-retention', () => ({ runApiOperationLogRetention: mocks.run }))
vi.mock('@/lib/api-operation-log-route', () => ({ withApiOperationLogging: (handler: unknown) => handler }))
import { POST as cron } from '@/app/api/cron/log-retention/route'
import { POST as admin } from '@/app/api/admin/logs/retention/route'

beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({ user: { id: 'admin' } }); mocks.run.mockResolvedValue({ status: 'skipped_locked', deletedCount: 0 }); vi.stubEnv('CRON_SECRET', '') })
afterEach(() => vi.unstubAllEnvs())
const request = (secret = '') => new Request('http://localhost/api/cron/log-retention', { method: 'POST', headers: { authorization: 'Bearer ' + secret } })
test('fails closed when CRON_SECRET is missing even if another internal secret is configured', async () => {
  vi.stubEnv('AI_NEWS_CRON_SECRET', 'unrelated-secret')
  expect((await cron(request('unrelated-secret'))).status).toBe(503)
  expect(mocks.run).not.toHaveBeenCalled()
})
test('accepts only CRON_SECRET and invokes the shared runner once', async () => {
  vi.stubEnv('CRON_SECRET', 'retention-specific-secret')
  expect((await cron(request('wrong'))).status).toBe(401)
  expect(mocks.run).not.toHaveBeenCalled()
  const response = await cron(request('retention-specific-secret'))
  expect(response.status).toBe(200)
  expect(mocks.run).toHaveBeenCalledExactlyOnceWith('cron')
  expect(await response.json()).toMatchObject({ success: true, data: { status: 'skipped_locked' } })
})
test.each([new UnauthorizedError(), new ForbiddenError()])('admin maintenance requires a current admin session: $status', async (error) => {
  mocks.auth.mockRejectedValue(error)
  expect((await admin(request())).status).toBe(error.status)
  expect(mocks.run).not.toHaveBeenCalled()
})
test('admin maintenance uses the same bounded runner', async () => {
  expect((await admin(request())).status).toBe(200)
  expect(mocks.run).toHaveBeenCalledExactlyOnceWith('admin')
})
