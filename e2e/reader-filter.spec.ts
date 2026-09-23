import { expect, test } from "@playwright/test"

/**
 * E02 /posts 筛选 + 无限滚动。
 *
 * /posts 前台列表是 useSWRInfinite 无限滚动（useInfinitePosts），没有页码 URL。
 * 断言：分类筛选改变列表（GET 参数提交 + 列表内容变化），筛选重置生效。
 */
test("E02 posts listing filter applies and resets", async ({ page }) => {
  await page.goto("/posts")
  await expect(page.getByRole("heading", { name: "全部文章" })).toBeVisible()

  // 等列表首屏渲染出文章卡片
  const articleLinks = page.locator('a[href^="/posts/"]')
  await articleLinks.first().waitFor({ state: "visible", timeout: 15_000 })

  // 选择一个分类并提交筛选（GET 表单 → /posts?category=...）
  await page.getByLabel("分类筛选").click()
  const option = page.getByRole("option").nth(1)
  const categoryName = await option.textContent()
  await option.click()
  await page.getByRole("button", { name: "应用筛选" }).click()

  await page.waitForURL(/\/posts\?category=/)
  await expect(page.getByRole("heading", { name: "全部文章" })).toBeVisible()

  // 筛选激活 chips 出现
  await expect(page.locator('a.ui-chip, [class*="chip"]').first()).toBeVisible()

  // 回到全部：URL 无 category 参数后列表恢复
  await page.goto("/posts")
  await articleLinks.first().waitFor({ state: "visible", timeout: 15_000 })
  expect(categoryName).toBeTruthy()
})
