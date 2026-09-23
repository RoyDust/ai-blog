import { expect, test } from "@playwright/test"

import { createPostViaApi, deletePostViaApi } from "./helpers"

/**
 * E08 文章工作台编辑。
 *
 * 保存草稿成功后 router.push 到 /admin/posts/[id]/edit（无 toast）。
 * 真实可观察行为：跳转后编辑页加载，标题输入框回显新值。
 */
test("E08 edit post in workspace and persist", async ({ page }) => {
  const created = await createPostViaApi(page.request, { published: false })
  const newTitle = `${created.title}（已编辑 ${Date.now()}）`
  const newExcerpt = `E2E 编辑摘要 ${Date.now()}`

  try {
    await page.goto(`/admin/posts/${created.id}/edit`)
    await expect(page.getByRole("heading", { name: "编辑文章" })).toBeVisible({ timeout: 20_000 })

    await page.getByLabel("标题", { exact: true }).fill(newTitle)
    const excerptInput = page.getByPlaceholder("文章摘要（可选）")
    if (await excerptInput.isVisible().catch(() => false)) {
      await excerptInput.fill(newExcerpt)
    }

    await page.getByRole("button", { name: "保存草稿" }).click()

    // 保存成功：停留在编辑页，标题输入框回显新值（重新加载的表单数据）
    await page.waitForURL(new RegExp(`/admin/posts/${created.id}/edit`), { timeout: 30_000 })
    await expect(page.getByLabel("标题", { exact: true })).toHaveValue(newTitle, { timeout: 20_000 })
  } finally {
    await deletePostViaApi(page.request, created.id).catch(() => undefined)
  }
})
