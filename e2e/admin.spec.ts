import { expect, test } from '@playwright/test'

test('admin entry redirects non-admin users away', async ({ page }) => {
  await page.goto('/admin')
  await page.waitForLoadState('domcontentloaded')
  await expect(page).toHaveURL(/\/(login|$)/)
})
