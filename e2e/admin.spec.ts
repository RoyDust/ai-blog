import { expect, test } from '@playwright/test'

test('admin entry redirects non-admin users away', async ({ request }) => {
  const response = await request.get('/admin', { maxRedirects: 0 })
  const location = response.headers().location ?? ''

  expect(response.status()).toBeGreaterThanOrEqual(300)
  expect(response.status()).toBeLessThan(400)
  expect(location).toContain('login=1')
  expect(location).toContain('callbackUrl=%2Fadmin')
})
