import { expect, test } from '@playwright/test'

test('reader can browse and open article', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('main')).toBeVisible()
  await page.goto('/posts')
  await expect(page.getByRole('heading', { name: '全部文章' })).toBeVisible()
})
