import { expect, test } from "@playwright/test"

import { createPostViaApi, deletePostViaApi, uniqueSlug } from "./helpers"

/**
 * E14 系列管理 + 文章入系 + 前台排序。
 * 新建系列（表单：标题/Slug/创建系列，toast「系列已创建」）→
 * 文章编辑页「所属系列」Radix combobox 选择 → 保存草稿 → 前台 /series/[slug] 出现该文章。
 */
test("E14 series create assign post and front visibility", async ({ page }) => {
  const slug = uniqueSlug("series")
  const title = `E2E系列${Date.now()}`
  const post = await createPostViaApi(page.request, { published: true })

  try {
    await page.goto("/admin/series")

    // 新建系列
    await page.getByLabel("标题", { exact: true }).fill(title)
    await page.getByLabel("Slug", { exact: true }).fill(slug)
    await page.getByRole("button", { name: "创建系列" }).click()
    await expect(page.getByText("系列已创建")).toBeVisible({ timeout: 15_000 })

    // 列表出现
    await page.getByLabel("搜索系列").fill(title)
    await expect(page.locator("tr", { hasText: title }).first()).toBeVisible({ timeout: 20_000 })

    // 文章入系：编辑页「所属系列」Radix Select
    await page.goto(`/admin/posts/${post.id}/edit`)
    const seriesTrigger = page.getByRole("combobox", { name: "所属系列" })
    await seriesTrigger.waitFor({ state: "visible", timeout: 20_000 })
    await seriesTrigger.click()
    await page.getByRole("option", { name: title }).click()
    // 用发布提交（保存草稿会把 published 置 false，前台系列页只显示已发布文章）
    await page.getByRole("button", { name: "发布文章" }).click()
    await page.getByRole("button", { name: "确认发布" }).click()

    // 发布成功跳前台详情
    await page.waitForURL(new RegExp(`/posts/${post.slug}$`), { timeout: 30_000 })

    // 前台系列页出现该文章（生产 ISR：revalidate 后首请求可能 stale，用轮询）
    await expect
      .poll(
        async () => {
          const response = await page.request.get(`/series/${slug}`)
          const body = await response.text()
          return body.includes(`/posts/${post.slug}`) ? "visible" : "pending"
        },
        { timeout: 60_000, intervals: [3_000] },
      )
      .toBe("visible")
    await page.goto(`/series/${slug}`)
    await expect(page.locator(`a[href="/posts/${post.slug}"]`).first()).toBeVisible({ timeout: 20_000 })
  } finally {
    await deletePostViaApi(page.request, post.id).catch(() => undefined)
  }
})
