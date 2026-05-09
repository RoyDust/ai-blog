import { expect, test } from '@playwright/test'

test('author write shortcut redirects unauthenticated users to login prompt', async ({ page }) => {
  await page.goto('/write')
  await expect(page).toHaveURL(/[?&]login=1/)
})
