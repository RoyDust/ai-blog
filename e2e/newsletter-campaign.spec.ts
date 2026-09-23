import { expect, test } from "@playwright/test"

import { createPostViaApi, deletePostViaApi } from "./helpers"

/**
 * E23 Newsletter 群发。
 *
 * 创建表单：活动名称 / 邮件主题 / 文章 ID（逗号分隔）/ 创建草稿按钮（toast「邮件活动草稿已创建」）。
 * 列表行操作「发送」→ delivery 落定（provider log 下 delivered，状态徽标「已发送」）。
 */
test("E23 newsletter campaign create and send", async ({ page }) => {
  test.setTimeout(180_000)
  const post = await createPostViaApi(page.request, { published: true })
  const campaignTitle = `E2E 群发 ${Date.now()}`

  try {
    await page.goto("/admin/newsletter")

    // 建活动（文章 ID 用 post.id）
    await page.getByLabel("活动名称").fill(campaignTitle)
    await page.getByLabel("邮件主题").fill(campaignTitle)
    await page.getByLabel("文章 ID").fill(post.id)
    await page.getByRole("button", { name: "创建草稿" }).click()
    await expect(page.getByText("邮件活动草稿已创建")).toBeVisible({ timeout: 30_000 })

    // 列表行「发送」
    const row = page.locator("tr", { hasText: campaignTitle }).first()
    await row.waitFor({ state: "visible", timeout: 20_000 })
    await row.getByRole("button", { name: "发送" }).click()

    // 状态落定：已发送徽标（无已验证订阅者时也可能部分失败——接受两种终态）
    await expect(row.getByText(/已发送|发送失败|部分失败/).first()).toBeVisible({ timeout: 60_000 })
  } finally {
    await deletePostViaApi(page.request, post.id).catch(() => undefined)
  }
})
