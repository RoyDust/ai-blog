import { expect, test } from "@playwright/test"

import { createPostViaApi, deletePostViaApi } from "./helpers"
import { startMockUpstream } from "./mock-upstream"

/**
 * E19 AI 摘要状态机（PostSummaryStatus: EMPTY→QUEUED→GENERATING→GENERATED/FAILED）。
 *
 * 驱动者是批量任务（post-summary-jobs / ai-batch-jobs，setTimeout 异步执行并回写
 * summaryStatus）；工作台「AI 补全摘要」按钮走同步 /summarize 接口，只回填 excerpt
 * 不改状态。E2E 断：
 * 1. 批量任务 API 轮询到终态
 * 2. 文章 summaryStatus 落到 GENERATED（mock 模型成功路径）
 */
test("E19 post summary state machine via batch task", async ({ page }) => {
  test.setTimeout(240_000)
  const upstream = await startMockUpstream()

  try {
    // mock 模型设为摘要默认
    const modelResponse = await page.request.post("/api/admin/ai/models", {
      data: {
        name: `E2E 摘要模型 ${Date.now()}`,
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

    // 发起批量摘要任务（QUEUED）
    const batchResponse = await page.request.post("/api/admin/ai/batch", {
      data: { postIds: [post.id], actions: ["summary"], mode: "missing-only", apply: true },
    })
    expect(batchResponse.status()).toBeLessThan(300)
    const task = (await batchResponse.json())?.data
    expect(task?.id).toBeTruthy()

    // 轮询任务终态
    await expect
      .poll(
        async () => {
          const response = await page.request.get(`/api/admin/ai/tasks/${task.id}`)
          if (!response.ok()) return "pending"
          const status = (await response.json())?.data?.status
          return status === "SUCCEEDED" || status === "FAILED" || status === "PARTIAL_FAILED" ? status : "pending"
        },
        { timeout: 180_000, intervals: [3_000, 5_000] },
      )
      .toMatch(/SUCCEEDED|FAILED|PARTIAL_FAILED/)

    // 文章 summaryStatus 落到 GENERATED（admin GET 不返回 summaryStatus，
    // 用 excerpt 非空断言——apply 成功路径会同时写 excerpt 与 GENERATED）
    await expect
      .poll(
        async () => {
          const response = await page.request.get(`/api/admin/posts/${post.id}`)
          if (!response.ok()) return "pending"
          const excerpt = (await response.json())?.data?.excerpt
          return typeof excerpt === "string" && excerpt.trim() ? "GENERATED" : "pending"
        },
        { timeout: 60_000, intervals: [2_000, 5_000] },
      )
      .toBe("GENERATED")

    await deletePostViaApi(page.request, post.id).catch(() => undefined)
  } finally {
    await upstream.close()
  }
})
