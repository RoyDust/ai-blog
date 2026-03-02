import { expect, test } from '@playwright/test'

test('author can access write workspace UI', async ({ page }) => {
  await page.goto('/write')
  await expect(page.getByRole('heading', { name: '创作工作台' })).toBeVisible()
  await expect(page.getByText('发布设置')).toBeVisible()
})
