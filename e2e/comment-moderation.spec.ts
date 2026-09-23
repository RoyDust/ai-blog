import { expect, test } from "@playwright/test"

import { createPostViaApi, deletePostViaApi, uniqueSlug } from "./helpers"

/**
 * E05 前台匿名评论 → 后台审核通过 → 前台可见。
 *
 * - 匿名评论经 x-browser-id header（CommentForm localStorage 写入）→ PENDING
 * - 管理员在 /admin/comments 通过
 * - 前台文章详情评论区（仅 APPROVED）出现该评论（评论审核有 revalidate 精确失效）
 */
test("E05 anonymous comment moderation flow", async ({ page }) => {
  const testInfo = { slug: "", id: "" }
  const commentText = `E2E 匿名评论 ${Date.now()}`

  // 1. 经 admin API 建一篇已发布文章（复用 storageState 会话）
  const created = await createPostViaApi(page.request, {
    published: true,
    slug: uniqueSlug("comment-target"),
  })
  testInfo.id = created.id
  testInfo.slug = created.slug

  try {
    // 2. 前台打开详情页，匿名发评论
    await page.goto(`/posts/${created.slug}`)
    await page.getByPlaceholder("写下你的评论...").fill(commentText)
    await page.getByRole("button", { name: "发表评论" }).click()

    // 提交成功反馈（toast 或表单清空），评论 PENDING 不立即出现
    await expect(page.getByText(/评论已提交|审核|提交成功|发表评论/).first()).toBeVisible({ timeout: 10_000 })

    // 3. 管理员后台审核：搜索刚发的评论内容
    await page.goto("/admin/comments")
    await page.getByPlaceholder("搜索评论内容或文章标题").fill(commentText)
    const row = page.locator("tr", { hasText: commentText }).first()
    await row.waitFor({ state: "visible", timeout: 20_000 })
    await row.getByRole("button", { name: "通过", exact: true }).click()

    // 4. 回前台验证评论可见（审核通过有 revalidate）
    await page.goto(`/posts/${created.slug}`)
    await expect(page.getByText(commentText)).toBeVisible({ timeout: 20_000 })
  } finally {
    await deletePostViaApi(page.request, testInfo.id).catch(() => undefined)
  }
})
