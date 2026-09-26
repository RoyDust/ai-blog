import { expect, test } from "@playwright/test"
import { createPostViaApi, deletePostViaApi } from "./helpers"
import { purgeOwnedPost } from "./post-fixtures"
import { withResourceScope } from "./resource-scope"

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
  await withResourceScope(async (defer) => {
    const post = await createPostViaApi(page.request, { published: true })
    defer(async () => {
      await deletePostViaApi(page.request, post.id)
      await purgeOwnedPost(post.id, post.slug)
    })

    await page.goto("/")
    await expect(page.getByRole("main")).toBeVisible()

    // 首页唯一 H1
    await expect(page.locator("h1")).toHaveCount(1)

    // 从列表进入本用例的文章，不依赖构建前或其他用例留下的数据。
    await page.goto("/posts")
    const articleLink = page.getByTestId("posts-listing").locator(`a[href="/posts/${post.slug}"]`).first()
    await expect(articleLink).toBeVisible({ timeout: 15_000 })
    await articleLink.click()
    await expect(page).toHaveURL(`/posts/${post.slug}`)
    await expect(page.getByRole("heading", { name: post.title, exact: true })).toBeVisible()

    // 阅读进度条组件存在（fixed 定位）
    await expect(page.locator('[class*="reading-progress"], [data-reading-progress], .fixed').first()).toBeAttached()

    // 无横向溢出
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }))
    expect(overflow.scrollWidth, "no horizontal overflow").toBeLessThanOrEqual(overflow.innerWidth)
  })
})
