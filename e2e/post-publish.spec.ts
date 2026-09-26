import { expect, test } from "@playwright/test"

import { deletePostViaApi, uniqueSlug } from "./helpers"
import { withResourceScope } from './resource-scope'
import { purgeOwnedPost } from './post-fixtures'

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
  await withResourceScope(async (defer) => {

  await page.goto("/write") // 登录态下重定向到 /admin/posts/new
  await page.waitForURL(/\/admin\/posts\/new/)

  await page.getByLabel("标题", { exact: true }).fill(title)
  await page.getByLabel("Slug", { exact: true }).fill(slug)
  await page.getByLabel("内容", { exact: true }).fill(`# ${title}\n\nE2E 发布流程正文。`)

  await page.getByRole("button", { name: "发布文章" }).click()
  const created = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/admin/posts' && response.request().method() === 'POST' && response.ok())
  await page.getByRole("button", { name: "确认发布" }).click()
  const body = await (await created).json()
  const id = body?.data?.id
  if (typeof id !== 'string') throw new Error('Created post response has no id')
  defer(async () => {
    await deletePostViaApi(page.request, id)
    await purgeOwnedPost(id, slug)
  })

  // 发布成功跳前台详情
  await page.waitForURL(new RegExp(`/posts/${slug}$`), { timeout: 30_000 })
  await expect(page.getByRole("heading", { name: title })).toBeVisible({ timeout: 20_000 })

  })
})
