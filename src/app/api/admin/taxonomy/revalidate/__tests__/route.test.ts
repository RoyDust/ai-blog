import { beforeEach, expect, test, vi } from 'vitest'
import { ForbiddenError, UnauthorizedError } from '@/lib/api-errors'
const mocks = vi.hoisted(() => ({ auth: vi.fn(), revalidate: vi.fn() }))
vi.mock('@/lib/api-auth', () => ({ requireAdminSession: mocks.auth }))
vi.mock('@/lib/cache', () => ({ revalidatePublicPathsStrict: mocks.revalidate }))
vi.mock('@/lib/api-operation-log-route', () => ({ withApiOperationLogging: (handler: unknown) => handler }))
import { POST } from '../route'

beforeEach(() => {
  vi.resetAllMocks()
  mocks.auth.mockResolvedValue({ user: { id: 'admin' } })
  mocks.revalidate.mockImplementation((paths: string[]) => ({ paths, errors: [] }))
})
function request(paths: unknown) { return new Request('http://localhost/api/admin/taxonomy/revalidate', { method: 'POST', body: JSON.stringify({ paths }) }) }

test.each([new UnauthorizedError(), new ForbiddenError()])('requires an administrator before invalidation: $status', async (error) => {
  mocks.auth.mockRejectedValue(error)
  expect((await POST(request(['/tags/one']))).status).toBe(error.status)
  expect(mocks.revalidate).not.toHaveBeenCalled()
})
test.each([[], ['/admin'], ['/api/admin/posts'], ['/posts/../../admin'], ['https://external.test/'], ['//posts/one'], ['/posts/UPPER'], Array(501).fill('/tags/one')])('rejects invalid public path sets', async (paths) => {
  expect((await POST(request(paths))).status).toBe(400)
  expect(mocks.revalidate).not.toHaveBeenCalled()
})
test('retries old and new paths, including affected guides', async () => {
  const paths = ['/tags/old', '/tags/new', '/posts/article', '/guides/topic']
  const response = await POST(request(paths))
  expect(response.status).toBe(200)
  expect(mocks.revalidate).toHaveBeenCalledWith(paths)
  expect(await response.json()).toEqual({ success: true, data: { paths, failedPaths: [] } })
})
test('reports partial invalidation without losing the retry paths', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  mocks.revalidate.mockReturnValue({ paths: ['/tags/one', '/guides/topic'], errors: [{ path: '/guides/topic', error: 'cache failed' }] })
  const response = await POST(request(['/tags/one', '/guides/topic']))
  expect(response.status).toBe(503)
  expect(await response.json()).toEqual({ success: false, data: { paths: ['/tags/one', '/guides/topic'], failedPaths: ['/guides/topic'] } })
  error.mockRestore()
})
