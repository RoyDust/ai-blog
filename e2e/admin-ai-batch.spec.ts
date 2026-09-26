import { expect, test } from "@playwright/test"

import { withMockAiModel } from "./ai-fixtures"
import { createPostViaApi, deletePostViaApi, waitForAiTask } from "./helpers"

for (const retry of [false, true]) {
  test(retry ? "E18 failed AI batch item succeeds after retry" : "E18 AI batch task succeeds and applies its result", async ({ page }) => {
    test.setTimeout(240_000)

    await withMockAiModel(page.request, async ({ modelId, upstream }) => {
      const post = await createPostViaApi(page.request, { published: false })
      try {
        upstream.setCompletionFailure(retry)
        const response = await page.request.post("/api/admin/ai/batch", {
          data: { postIds: [post.id], actions: ["summary"], mode: "missing-only", apply: true, modelId },
        })
        expect(response.ok()).toBe(true)
        let task = (await response.json()).data
        expect(task.id).toBeTruthy()

        if (retry) {
          const failed = await waitForAiTask(page.request, task.id)
          expect(failed).toMatchObject({ status: "FAILED", succeededCount: 0, failedCount: 1 })
          upstream.setCompletionFailure(false)
          const retryResponse = await page.request.post(
            "/api/admin/ai/tasks/" + task.id + "/retry",
          )
          expect(retryResponse.ok()).toBe(true)
          task = (await retryResponse.json()).data
        }

        const completed = await waitForAiTask(page.request, task.id)
        expect(completed).toMatchObject({ status: "SUCCEEDED", succeededCount: 1, failedCount: 0 })
        expect(completed.items).toEqual([
          expect.objectContaining({ postId: post.id, status: "SUCCEEDED", applied: true }),
        ])
        const postResponse = await page.request.get("/api/admin/posts/" + post.id)
        expect(postResponse.ok()).toBe(true)
        expect((await postResponse.json()).data.excerpt).toBe("E2E mock 补全内容，用于本地 mock 上游返回值。")

        await page.goto("/admin/ai/tasks")
        await expect(page.locator('a[href="/admin/ai/tasks/' + task.id + '"]')).toBeVisible()
      } finally {
        await deletePostViaApi(page.request, post.id)
      }
    })
  })
}
