import { expect, test, type APIRequestContext } from "@playwright/test"

import { withMockAiModel } from "./ai-fixtures"
import { createPostViaApi, deletePostViaApi, uniqueSlug } from "./helpers"

type AiNewsRunRecord = {
  id: string
  status: "RUNNING" | "SUCCEEDED" | "FAILED" | "SKIPPED"
  postId: string | null
  postSlug: string | null
  published: boolean
  error: string | null
}

async function waitForAiNewsRun(request: APIRequestContext, runId: string): Promise<AiNewsRunRecord> {
  let latest: AiNewsRunRecord | undefined
  await expect
    .poll(
      async () => {
        const response = await request.get(`/api/admin/ai-news/run?runId=${encodeURIComponent(runId)}`)
        expect(response.ok()).toBe(true)
        latest = (await response.json()).data as AiNewsRunRecord
        return latest?.status
      },
      { timeout: 240_000, intervals: [1_000, 2_000] },
    )
    .toMatch(/^(SUCCEEDED|FAILED|SKIPPED)$/)

  if (!latest) {
    throw new Error(`AI news run ${runId} returned no record`)
  }
  return latest
}

/** E20：通过非覆盖首跑建立 AI 归属日报后再验证重生成，同时校验人工同名草稿不会被覆盖。 */
test("E20 manual AI news run creates and regenerates AI-owned article while protecting manual drafts", async ({ page }) => {
  test.setTimeout(300_000)
  const baseYear = 2100 + Math.floor(Math.random() * 90)
  const month = Math.floor(Math.random() * 12)
  const day = 1 + Math.floor(Math.random() * 28)
  const date = new Date(Date.UTC(baseYear, month, day, 12))
  const dateId = date.toISOString().slice(0, 10)
  const expectedSlug = "ai-daily-" + dateId

  const manualConflictDate = new Date(Date.UTC(baseYear + 1, month, day, 12))
  const manualConflictDateId = manualConflictDate.toISOString().slice(0, 10)
  const manualPost = await createPostViaApi(page.request, {
    slug: "ai-daily-" + manualConflictDateId,
    published: false,
  })

  const newsUrl = "https://example.com/" + uniqueSlug("news")
  let createdAiPostId: string | null = null

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
        // 1. 人工同名草稿保护：regenerate=true 不得覆盖人工创建的草稿（同步返回 409）
        const conflictResponse = await page.request.post("/api/admin/ai-news/run", {
          data: { date: manualConflictDateId, sourceMode: "selected", sourceIds: [source.id], modelId, regenerate: true },
          timeout: 60_000,
        })
        const conflictPayload = await conflictResponse.json()
        expect(conflictResponse.status(), JSON.stringify(conflictPayload).slice(0, 300)).toBe(409)
        expect(conflictPayload.error).toBe("Daily AI news slug is occupied by a manual post")

        // 2. 首跑（regenerate=false）：同步落库 RUNNING runId 后返回 202，再按 runId 轮询至完成
        const createResponse = await page.request.post("/api/admin/ai-news/run", {
          data: { date: dateId, sourceMode: "selected", sourceIds: [source.id], modelId, regenerate: false },
          timeout: 60_000,
        })
        const createPayload = await createResponse.json()
        expect(createResponse.status(), JSON.stringify(createPayload).slice(0, 300)).toBe(202)
        expect(createPayload.data).toMatchObject({
          operation: "queued",
          date: dateId,
          run: { status: "RUNNING" },
        })
        const createRunId = String(createPayload.data?.runId ?? "")
        expect(createRunId).toBeTruthy()

        const createdRun = await waitForAiNewsRun(page.request, createRunId)
        if (createdRun.postId) {
          createdAiPostId = String(createdRun.postId)
        }
        expect(createdRun).toMatchObject({
          id: createRunId,
          status: "SUCCEEDED",
          published: true,
          postSlug: expectedSlug,
        })
        expect(createdAiPostId).toBeTruthy()

        // 3. 重跑（regenerate=true）：允许覆盖 generatedByAiNews=true 的自有日报
        const response = await page.request.post("/api/admin/ai-news/run", {
          data: { date: dateId, sourceMode: "selected", sourceIds: [source.id], modelId, regenerate: true },
          timeout: 60_000,
        })
        const payload = await response.json()
        expect(response.status(), JSON.stringify(payload).slice(0, 300)).toBe(202)
        const regenerateRunId = String(payload.data?.runId ?? "")
        expect(regenerateRunId).toBeTruthy()

        const regeneratedRun = await waitForAiNewsRun(page.request, regenerateRunId)
        expect(regeneratedRun).toMatchObject({
          id: regenerateRunId,
          status: "SUCCEEDED",
          published: true,
          postId: createdAiPostId,
          postSlug: expectedSlug,
        })

        const published = await page.request.get("/api/posts/" + expectedSlug)
        expect(published.ok()).toBe(true)
        expect((await published.json()).data).toMatchObject({ id: createdAiPostId, published: true })

        await page.goto("/admin/ai-news")
        await expect(page.getByText("已完成").first()).toBeVisible({ timeout: 30_000 })
      } finally {
        const response = await page.request.delete("/api/admin/ai-news/sources/" + source.id)
        expect(response.ok(), "delete test news source").toBe(true)
      }
    }, { rssItems: [{ title: "E2E Mock News " + dateId, link: newsUrl, publishedAt: date }] })
  } finally {
    await deletePostViaApi(page.request, manualPost.id)
    if (createdAiPostId) {
      await deletePostViaApi(page.request, createdAiPostId)
    }
  }
})
