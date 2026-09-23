import { expect, test } from '@playwright/test'

/**
 * 未登录访问 /admin 跳登录（middleware 语义）。
 * chromium project 默认带 admin storageState；这里显式清空 cookies 模拟未登录访客。
 */
test.use({ storageState: { cookies: [], origins: [] } })

test('admin entry redirects non-admin users away', async ({ request }) => {
  const response = await request.get('/admin', { maxRedirects: 0 })
  const location = response.headers().location ?? ''

  expect(response.status()).toBeGreaterThanOrEqual(300)
  expect(response.status()).toBeLessThan(400)
  expect(location).toContain('login=1')
  expect(location).toContain('callbackUrl=%2Fadmin')
})
