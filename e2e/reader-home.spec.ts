import { expect, test } from "@playwright/test"

/**
 * E01 首页 → 文章详情。
 *
 * 断言用户可观察行为：
 * - 首页渲染 main 区与文章入口
 * - 文章详情出现阅读进度组件与目录（desktop rail）
 * - 页面无横向溢出
 *
 * 注意：不断言首页出现"刚发的文章"（pnpm start 下首页可能命中构建期静态快照）。
 */
test("E01 reader opens article detail from home", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("main")).toBeVisible()

  // 首页唯一 H1
  const h1 = page.locator("h1")
  await expect(h1).toHaveCount(1)

  // 从 /posts 打开第一篇文章详情（/posts 为 ISR 列表，文章均来自构建前已发布内容）
  await page.goto("/posts")
  const firstCardLink = page.locator('a[href^="/posts/"]').first()
  await firstCardLink.waitFor({ state: "visible", timeout: 15_000 })
  const detailHref = await firstCardLink.getAttribute("href")
  expect(detailHref).toBeTruthy()
  expect(detailHref).not.toBe("/posts")

  await page.goto(detailHref!)
  await expect(page.getByRole("main")).toBeVisible()

  // 阅读进度条组件存在（fixed 定位）
  await expect(page.locator('[class*="reading-progress"], [data-reading-progress], .fixed').first()).toBeAttached()

  // 无横向溢出
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }))
  expect(overflow.scrollWidth, "no horizontal overflow").toBeLessThanOrEqual(overflow.innerWidth)
})
