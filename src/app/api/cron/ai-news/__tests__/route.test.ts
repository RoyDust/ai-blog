import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

const findFirstUser = vi.fn()
const runDailyAiNews = vi.fn()
const notifyDailyAiNewsSuccess = vi.fn()
const notifyDailyAiNewsFailure = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: findFirstUser,
    },
  },
}))

vi.mock("@/lib/ai-news", () => ({
  runDailyAiNews,
}))

vi.mock("@/lib/ai-news-notifications", () => ({
  notifyDailyAiNewsSuccess,
  notifyDailyAiNewsFailure,
}))

describe("POST /api/cron/ai-news", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env = { ...originalEnv, AI_NEWS_CRON_SECRET: "cron-secret" }
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  test("rejects requests without the cron bearer secret", async () => {
    const { POST } = await import("../route")
    const response = await POST(new Request("http://localhost/api/cron/ai-news", { method: "POST" }))
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({ error: "Unauthorized" })
    expect(findFirstUser).not.toHaveBeenCalled()
    expect(runDailyAiNews).not.toHaveBeenCalled()
  })

  test("runs daily AI news as the oldest admin user and returns the generation result", async () => {
    findFirstUser.mockResolvedValueOnce({ id: "admin-1" })
    const runResult = {
      operation: "created",
      published: true,
      post: { id: "post-1", title: "AI 日报", slug: "ai-daily-2026-04-29", published: true },
      sourceCount: 8,
      failures: [],
      metrics: {
        rawCandidateCount: 10,
        dedupedCandidateCount: 8,
        scoredCandidateCount: 8,
        selectedCandidateCount: 6,
        sourceFailureJson: null,
        qualityScore: 86,
        citationCoverage: 1,
        generationMode: "candidate-pipeline",
      },
      run: { id: "run-1", status: "SUCCEEDED" },
    }
    runDailyAiNews.mockResolvedValueOnce(runResult)

    const { POST } = await import("../route")
    const response = await POST(
      new Request("http://localhost/api/cron/ai-news?date=2026-04-29", {
        method: "POST",
        headers: { Authorization: "Bearer cron-secret" },
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(findFirstUser).toHaveBeenCalledWith({
      where: { role: "ADMIN" },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    })
    expect(runDailyAiNews).toHaveBeenCalledWith({ authorId: "admin-1", date: new Date("2026-04-29T00:00:00.000Z"), regenerate: false, trigger: "cron" })
    expect(payload).toEqual({ success: true, data: runResult })
    expect(notifyDailyAiNewsSuccess).toHaveBeenCalledWith(runResult, new Date("2026-04-29T00:00:00.000Z"))
  })

  test("passes regenerate=true for protected cron reruns", async () => {
    findFirstUser.mockResolvedValueOnce({ id: "admin-1" })
    const runResult = {
      operation: "regenerated",
      published: false,
      post: { id: "post-1", title: "AI 日报", slug: "ai-daily-2026-04-29", published: false },
      sourceCount: 8,
      failures: [],
      run: { id: "run-1", status: "SUCCEEDED" },
    }
    runDailyAiNews.mockResolvedValueOnce(runResult)

    const { POST } = await import("../route")
    const response = await POST(
      new Request("http://localhost/api/cron/ai-news?date=2026-04-29&regenerate=true", {
        method: "POST",
        headers: { Authorization: "Bearer cron-secret" },
      }),
    )

    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({ success: true, data: runResult })
    expect(runDailyAiNews).toHaveBeenCalledWith({
      authorId: "admin-1",
      date: new Date("2026-04-29T00:00:00.000Z"),
      regenerate: true,
      trigger: "cron",
    })
    expect(notifyDailyAiNewsSuccess).toHaveBeenCalledWith(runResult, new Date("2026-04-29T00:00:00.000Z"))
  })

  test("returns already-queued for duplicate runs on the same date", async () => {
    findFirstUser.mockResolvedValue({ id: "admin-1" })
    runDailyAiNews.mockReturnValueOnce(new Promise(() => {}))

    const { POST } = await import("../route")
    const firstResponse = POST(
      new Request("http://localhost/api/cron/ai-news?date=2026-04-29", {
        method: "POST",
        headers: { Authorization: "Bearer cron-secret" },
      }),
    )
    await Promise.resolve()
    await Promise.resolve()
    const secondResponse = await POST(
      new Request("http://localhost/api/cron/ai-news?date=2026-04-29", {
        method: "POST",
        headers: { Authorization: "Bearer cron-secret" },
      }),
    )

    await expect(secondResponse.json()).resolves.toEqual({ success: true, data: { operation: "already-queued", date: "2026-04-29" } })
    expect(secondResponse.status).toBe(202)
    expect(runDailyAiNews).toHaveBeenCalledTimes(1)
    void firstResponse
  })

  test("records failure notifications when the daily AI news run rejects", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
    findFirstUser.mockResolvedValueOnce({ id: "admin-1" })
    runDailyAiNews.mockRejectedValueOnce(new Error("feed fetch failed"))

    const { POST } = await import("../route")
    const response = await POST(
      new Request("http://localhost/api/cron/ai-news?date=2026-04-29", {
        method: "POST",
        headers: { Authorization: "Bearer cron-secret" },
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload).toEqual({ error: "feed fetch failed" })
    expect(notifyDailyAiNewsFailure).toHaveBeenCalledWith(new Date("2026-04-29T00:00:00.000Z"), expect.any(Error))
    consoleError.mockRestore()
  })

  test("fails closed when the cron secret is not configured", async () => {
    delete process.env.AI_NEWS_CRON_SECRET

    const { POST } = await import("../route")
    const response = await POST(
      new Request("http://localhost/api/cron/ai-news", {
        method: "POST",
        headers: { Authorization: "Bearer cron-secret" },
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload).toEqual({ error: "AI_NEWS_CRON_SECRET is not configured" })
    expect(findFirstUser).not.toHaveBeenCalled()
  })
})
