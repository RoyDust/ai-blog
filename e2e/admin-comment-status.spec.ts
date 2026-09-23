import { expect, test } from "@playwright/test"

import { createPostViaApi, deletePostViaApi } from "./helpers"

/**
 * E11 评论管理：通过/驳回/标 SPAM。
 * 后台 /admin/comments 行内操作即时反映状态徽标（approved 等）。
 */
test("E11 comment status transitions in admin", async ({ page }) => {
  const post = await createPostViaApi(page.request, { published: true })
  const commentText = `E2E 状态机评论 ${Date.now()}`

  try {
    // 经 API 直接建评论（前端 CommentForm 只发 PENDING；这里走同端点）
    const response = await page.request.post("/api/comments", {
      data: { postId: post.id, content: commentText },
      headers: { "x-browser-id": `anon_e2e-${Date.now()}` },
    })
    expect(response.status()).toBeLessThan(300)

    await page.goto("/admin/comments")
    await page.getByPlaceholder("搜索评论内容或文章标题").fill(commentText)
    const row = page.locator("tr", { hasText: commentText }).first()
    await row.waitFor({ state: "visible", timeout: 20_000 })

    // 通过
    await row.getByRole("button", { name: "通过", exact: true }).click()
    await expect(row).toContainText("已通过", { timeout: 15_000 })

    // 驳回
    await page.goto("/admin/comments")
    await page.getByPlaceholder("搜索评论内容或文章标题").fill(commentText)
    const row2 = page.locator("tr", { hasText: commentText }).first()
    await row2.waitFor({ state: "visible", timeout: 20_000 })
    await row2.getByRole("button", { name: "驳回", exact: true }).click()
    await expect(row2).toContainText("已驳回", { timeout: 15_000 })
  } finally {
    await deletePostViaApi(page.request, post.id).catch(() => undefined)
  }
})
