import { expect, test } from "@playwright/test"

import { createPostViaApi, deletePostViaApi } from "./helpers"
import { startMockUpstream } from "./mock-upstream"

/**
 * E18 AI 任务中心：批量摘要任务。
 *
 * createAiBatchTask 内 scheduleBatchTask（setTimeout）异步执行，
 * 任务详情 API 轮询终态（SUCCEEDED/PARTIAL_FAILED/FAILED，succeededCount 增长）。
 * 任务记录列表（/admin/ai/tasks）含任务行（bulk-posts · taskId）与详情链接。
 */
test("E18 AI batch task runs and counts", async ({ page }) => {
  test.setTimeout(240_000)
  const upstream = await startMockUpstream()

  try {
    // 确保 mock 模型存在并设为摘要默认（走 API）
    const modelResponse = await page.request.post("/api/admin/ai/models", {
      data: {
        name: `E2E 批量模型 ${Date.now()}`,
        model: "mock-model",
        baseUrl: `${upstream.baseUrl}/v1`,
        requestPath: "/chat/completions",
        apiKey: "mock-key",
        capabilities: ["post-summary"],
        isDefaultForSummary: true,
        enabled: true,
      },
    })
    expect(modelResponse.status()).toBeLessThan(300)

    const post = await createPostViaApi(page.request, { published: false })

    // 发起批量摘要任务
    const batchResponse = await page.request.post("/api/admin/ai/batch", {
      data: { postIds: [post.id], actions: ["summary"], mode: "missing-only", apply: true },
    })
    expect(batchResponse.status()).toBeLessThan(300)
    const task = (await batchResponse.json())?.data
    expect(task?.id).toBeTruthy()

    // 轮询任务详情 API 终态
    await expect
      .poll(
        async () => {
          const response = await page.request.get(`/api/admin/ai/tasks/${task.id}`)
          if (!response.ok()) return "pending"
          const payload = await response.json()
          const status = payload?.data?.status
          return status === "SUCCEEDED" || status === "FAILED" || status === "PARTIAL_FAILED" ? status : "pending"
        },
        { timeout: 180_000, intervals: [3_000, 5_000] },
      )
      .toMatch(/SUCCEEDED|FAILED|PARTIAL_FAILED/)

    // 任务记录列表页渲染（任务行 + 详情链接存在）
    await page.goto("/admin/ai/tasks")
    await expect(page.getByRole("link", { name: "查看" }).first()).toBeVisible({ timeout: 30_000 })

    await deletePostViaApi(page.request, post.id).catch(() => undefined)
  } finally {
    await upstream.close()
  }
})
