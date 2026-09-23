import { expect, test } from "@playwright/test"

import { createPostViaApi, deletePostViaApi, uniqueSlug } from "./helpers"

/**
 * E27 阅读分析。
 * 浏览文章 → VisitTracker 发 /api/analytics/visit → dashboard 访问统计出现增量（expect.poll）。
 * analytics 限流 30/分/IP，单次用例安全。
 */
test("E27 visit analytics records article view", async ({ page }) => {
  const post = await createPostViaApi(page.request, { published: true, slug: uniqueSlug("visit") })

  try {
    // 记录前置 viewCount（public post API 直接返回 post 对象，viewCount 是字段）
    const beforeResponse = await page.request.get(`/api/posts/${post.slug}`)
    const beforeViewCount = (await beforeResponse.json())?.data?.viewCount ?? 0

    // 浏览详情页（VisitTracker 自动 POST）
    await page.goto(`/posts/${post.slug}`)
    await expect(page.getByRole("main")).toBeVisible({ timeout: 20_000 })

    // 轮询 viewCount 增长（visit 记录同步写入 post.viewCount）
    await expect
      .poll(
        async () => {
          const response = await page.request.get(`/api/posts/${post.slug}`)
          if (!response.ok()) return beforeViewCount
          return (await response.json())?.data?.viewCount ?? beforeViewCount
        },
        { timeout: 30_000, intervals: [2_000] },
      )
      .toBeGreaterThan(beforeViewCount)

    // dashboard 访问面板可见
    await page.goto("/admin")
    await expect(page.getByText(/访问|浏览|趋势/).first()).toBeVisible({ timeout: 30_000 })
  } finally {
    await deletePostViaApi(page.request, post.id).catch(() => undefined)
  }
})
