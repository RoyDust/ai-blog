import { expect, test } from "@playwright/test"

import { deletePostViaApi, uniqueSlug } from "./helpers"

/**
 * E06 /write 建草稿 → 发布 → 前台可见。
 *
 * /write 重定向到 /admin/posts/new（CreatePostWorkspace）。
 * 工作台字段：标题 / Slug / 内容（MarkdownEditor）/ 发布设置。
 * 发布走「发布文章」→ 确认弹窗「确认发布」→ 成功跳前台 /posts/[slug]。
 */
test("E06 create draft then publish from workspace", async ({ page }) => {
  const slug = uniqueSlug("e2e")
  const title = `E2E 工作台发布 ${Date.now()}`

  await page.goto("/write") // 登录态下重定向到 /admin/posts/new
  await page.waitForURL(/\/admin\/posts\/new/)

  await page.getByLabel("标题", { exact: true }).fill(title)
  await page.getByLabel("Slug", { exact: true }).fill(slug)
  await page.getByLabel("内容", { exact: true }).fill(`# ${title}\n\nE2E 发布流程正文。`)

  await page.getByRole("button", { name: "发布文章" }).click()
  await page.getByRole("button", { name: "确认发布" }).click()

  // 发布成功跳前台详情
  await page.waitForURL(new RegExp(`/posts/${slug}$`), { timeout: 30_000 })
  await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 20_000 })

  // 清理
  const listResponse = await page.request.get(`/api/admin/posts?query=${slug}`)
  if (listResponse.ok()) {
    const payload = await listResponse.json()
    const found = payload?.data?.posts?.find((post: { slug: string }) => post.slug === slug)
    if (found?.id) {
      await deletePostViaApi(page.request, found.id)
    }
  }
})
