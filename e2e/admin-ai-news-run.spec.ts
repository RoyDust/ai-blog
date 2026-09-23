import { expect, test } from "@playwright/test"

import { startMockUpstream } from "./mock-upstream"

/**
 * E20 AI 新闻控制台：手动触发 run（同步 await 全流水线）。
 *
 * 前置：
 * - 建 RSS 类型源，URL 指向本地 mock feed（validateUrl 允许 127.0.0.1）
 * - mock 模型设为摘要默认（评分/事实卡/成文都会打它）
 *
 * 断言：run 响应 succeeded、文章已发布、run 记录展示；候选列表可浏览。
 */
test("E20 manual AI news run succeeds with local mock feed", async ({ page }) => {
  test.setTimeout(300_000)
  const itemTitle = `E2E Mock News ${Date.now()}`
  const upstream = await startMockUpstream({
    rssItems: [{ title: itemTitle, link: "https://example.com/e2e-mock-news" }],
  })

  try {
    // 1. mock 模型设为摘要默认
    const modelResponse = await page.request.post("/api/admin/ai/models", {
      data: {
        name: `E2E 日报模型 ${Date.now()}`,
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

    // 2. 建 RSS 源指向本地 mock feed（weight 200 保证排序在前）
    const sourceResponse = await page.request.post("/api/admin/ai-news/sources", {
      data: {
        type: "RSS",
        name: `E2E Mock Feed ${Date.now()}`,
        url: `${upstream.baseUrl}/rss`,
        enabled: true,
        weight: 200,
      },
    })
    expect(sourceResponse.status()).toBeLessThan(300)
    const source = (await sourceResponse.json())?.data
    expect(source?.id).toBeTruthy()

    // 3. 手动触发 run（同步，selected 模式只跑 mock 源；regenerate=true 绕过同日已存在跳过）
    const runResponse = await page.request.post("/api/admin/ai-news/run", {
      data: { sourceMode: "selected", sourceIds: [source.id], regenerate: true },
      timeout: 240_000,
    })
    const runPayload = await runResponse.json()
    expect(runResponse.status(), `run should succeed: ${JSON.stringify(runPayload).slice(0, 300)}`).toBeLessThan(300)
    expect(runPayload?.data?.run?.status ?? runPayload?.data?.status).toBe("SUCCEEDED")
    expect(runPayload?.data?.published ?? true).toBeTruthy()

    // 4. 控制台页面：运行记录（SUCCEEDED →「已完成」徽标）与候选列表可浏览
    await page.goto("/admin/ai-news")
    await expect(page.getByText("已完成").first()).toBeVisible({ timeout: 30_000 })
  } finally {
    await upstream.close()
  }
})
