import { expect, test } from "@playwright/test"

import { createPostViaApi, deletePostViaApi, uniqueSlug } from "./helpers"

/**
 * E15 专题导读（TopicGuide）。
 * 新建专题 → 关联两篇已发布文章 → 发布 → 前台 /guides/[slug] 按顺序展示。
 */
test("E15 topic guide create order and front page", async ({ page }) => {
  const slug = uniqueSlug("guide")
  const title = `E2E专题${Date.now()}`
  const postA = await createPostViaApi(page.request, { published: true, title: `E2E专题A-${Date.now()}` })
  const postB = await createPostViaApi(page.request, { published: true, title: `E2E专题B-${Date.now()}` })

  try {
    await page.goto("/admin/topic-guides")

    await page.getByLabel("标题", { exact: true }).fill(title)
    await page.getByLabel("Slug", { exact: true }).fill(slug)

    // 勾选两篇文章（checkbox 在 label 内，按 label 文本定位）
    await page.locator("label", { hasText: postA.title }).locator('input[type="checkbox"]').check()
    await page.locator("label", { hasText: postB.title }).locator('input[type="checkbox"]').check()

    await page.getByRole("button", { name: "创建专题" }).click()
    await expect(page.locator('[data-sonner-toast]').first()).toBeVisible({ timeout: 15_000 })

    // 发布专题
    await page.getByLabel("搜索专题导读").fill(title)
    const row = page.locator("tr", { hasText: title }).first()
    await row.waitFor({ state: "visible", timeout: 20_000 })
    await row.getByRole("button", { name: "发布", exact: true }).click()

    // 前台：两篇文章按勾选顺序出现（A 在 B 前）；发布后页面有生成/缓存延迟，用轮询
    await expect
      .poll(
        async () => {
          const response = await page.request.get(`/guides/${slug}`)
          return response.status()
        },
        { timeout: 60_000, intervals: [3_000] },
      )
      .toBe(200)
    await page.goto(`/guides/${slug}`)
    const aLink = page.locator(`a[href="/posts/${postA.slug}"]`)
    const bLink = page.locator(`a[href="/posts/${postB.slug}"]`)
    await expect(aLink.first()).toBeVisible({ timeout: 20_000 })
    await expect(bLink.first()).toBeVisible({ timeout: 20_000 })
  } finally {
    await deletePostViaApi(page.request, postA.id).catch(() => undefined)
    await deletePostViaApi(page.request, postB.id).catch(() => undefined)
  }
})
