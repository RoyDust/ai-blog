import { expect, test } from "@playwright/test"

import { withMockAiModel } from "./ai-fixtures"
import { createPostViaApi, deletePostViaApi, uniqueSlug } from "./helpers"

/** E20：只重新生成测试先行创建的日报；不能命中当天的真实文章。 */
test("E20 manual AI news run publishes its reserved test article", async ({ page }) => {
  test.setTimeout(300_000)
  const date = new Date(Date.UTC(2100 + Math.floor(Math.random() * 100), Math.floor(Math.random() * 12), 1 + Math.floor(Math.random() * 28), 12))
  const dateId = date.toISOString().slice(0, 10)
  // POST 的 slug 唯一性检查负责占用日期；冲突时测试失败，不重写已有文章。
  const post = await createPostViaApi(page.request, { slug: "ai-daily-" + dateId, published: false })
  const newsUrl = "https://example.com/" + uniqueSlug("news")

  try {
    await withMockAiModel(page.request, async ({ modelId, upstream }) => {
      const sourceResponse = await page.request.post("/api/admin/ai-news/sources", {
        data: {
          type: "RSS", name: uniqueSlug("feed"), url: upstream.baseUrl + "/rss", enabled: true, weight: 200,
        },
      })
      expect(sourceResponse.ok()).toBe(true)
      const source = (await sourceResponse.json()).data
      expect(source.id).toBeTruthy()
      try {
        const response = await page.request.post("/api/admin/ai-news/run", {
          data: { date: dateId, sourceMode: "selected", sourceIds: [source.id], modelId, regenerate: true },
          timeout: 240_000,
        })
        const payload = await response.json()
        expect(response.ok(), JSON.stringify(payload).slice(0, 300)).toBe(true)
        expect(payload.data).toMatchObject({ operation: "regenerated", published: true, post: { id: post.id, slug: post.slug } })
        expect(payload.data.run.status).toBe("SUCCEEDED")

        const published = await page.request.get("/api/posts/" + post.slug)
        expect(published.ok()).toBe(true)
        expect((await published.json()).data).toMatchObject({ id: post.id, published: true })

        await page.goto("/admin/ai-news")
        await expect(page.getByText("已完成").first()).toBeVisible({ timeout: 30_000 })
      } finally {
        const response = await page.request.delete("/api/admin/ai-news/sources/" + source.id)
        expect(response.ok(), "delete test news source").toBe(true)
      }
    }, { rssItems: [{ title: "E2E Mock News " + dateId, link: newsUrl, publishedAt: date }] })
  } finally {
    await deletePostViaApi(page.request, post.id)
  }
})
