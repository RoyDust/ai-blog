import { expect, test } from "@playwright/test"

import { createPostViaApi, deletePostViaApi } from "./helpers"

/**
 * E24 通知中心。
 * 评论事件 → /admin/notifications 出现「有新评论」→「全部已读」按钮可用并点击。
 * markRead 成功反馈走 SWR mutate 重新拉取（无 toast），断言未读数变化。
 */
test("E24 notification center shows comment event", async ({ page }) => {
  const post = await createPostViaApi(page.request, { published: true })
  const commentText = `E2E 通知评论 ${Date.now()}`

  try {
    // 触发评论事件（评论创建会 createAdminNotification）
    const response = await page.request.post("/api/comments", {
      data: { postId: post.id, content: commentText },
      headers: { "x-browser-id": `anon_e2e-${Date.now()}` },
    })
    expect(response.status()).toBeLessThan(300)

    // 通知中心：「有新评论」标题可见 + 全部已读按钮可用
    await page.goto("/admin/notifications")
    await expect(page.getByRole("heading", { name: "有新评论" }).first()).toBeVisible({ timeout: 30_000 })

    const markAll = page.getByRole("button", { name: "全部已读" })
    await expect(markAll).toBeEnabled({ timeout: 20_000 })

    // 记录未读数 → 全部已读 → 未读提示变化（"N 条未读" → "当前没有未读通知"）
    const unreadBefore = await page.getByText(/条未读/).textContent()
    await markAll.click()
    await expect(page.getByText("当前没有未读通知")).toBeVisible({ timeout: 20_000 })
  } finally {
    await deletePostViaApi(page.request, post.id).catch(() => undefined)
  }
})
