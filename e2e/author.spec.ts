import { expect, test } from '@playwright/test'

/**
 * 未登录访问 /write 跳登录提示。
 * chromium project 默认带 admin storageState；这里显式清空 cookies 模拟未登录访客。
 * （browser.newContext() 不继承项目 use options，但页面路由会经历
 *  /write → /admin/posts/new → /?login=1 两跳 RSC 重定向，直接断言最终 URL。）
 */
test.use({ storageState: { cookies: [], origins: [] } })

test('author write shortcut redirects unauthenticated users to login prompt', async ({ page }) => {
  await page.goto('/write')
  await expect(page).toHaveURL(/[?&]login=1/, { timeout: 15_000 })
})
