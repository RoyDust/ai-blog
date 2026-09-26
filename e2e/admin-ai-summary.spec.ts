import { expect, test } from "@playwright/test"

import { withMockAiModel } from "./ai-fixtures"
import { createPostViaApi, deletePostViaApi, waitForAiTask } from "./helpers"

/** E19：批量摘要成功应用，文章摘要及生成状态均已持久化。 */
test("E19 post summary is generated and persisted", async ({ page }) => {
  test.setTimeout(240_000)
  await withMockAiModel(page.request, async ({ modelId }) => {
    const post = await createPostViaApi(page.request, { published: false })
    try {
      const response = await page.request.post("/api/admin/ai/batch", {
        data: { postIds: [post.id], actions: ["summary"], mode: "missing-only", apply: true, modelId },
      })
      expect(response.ok()).toBe(true)
      const task = (await response.json()).data
      expect(task.id).toBeTruthy()
      expect(await waitForAiTask(page.request, task.id)).toMatchObject({
        status: "SUCCEEDED", succeededCount: 1, failedCount: 0,
      })

      // 列表 API 返回 summaryStatus；详情 API 没有这个字段。
      const postsResponse = await page.request.get("/api/admin/posts?q=" + encodeURIComponent(post.slug))
      expect(postsResponse.ok()).toBe(true)
      const posts = (await postsResponse.json()).data as Array<{ id: string; excerpt: string; summaryStatus: string }>
      expect(posts.find((item) => item.id === post.id)).toMatchObject({
        excerpt: "E2E mock 补全内容，用于本地 mock 上游返回值。",
        summaryStatus: "GENERATED",
      })
    } finally {
      await deletePostViaApi(page.request, post.id)
    }
  })
})
