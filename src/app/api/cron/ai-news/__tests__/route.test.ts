import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

const findFirstUser = vi.fn()
const runDailyAiNews = vi.fn()

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

  test("runs daily AI news as the oldest admin user and returns the final result", async () => {
    findFirstUser.mockResolvedValueOnce({ id: "admin-1" })
    runDailyAiNews.mockResolvedValueOnce({
      operation: "created",
      published: true,
      post: { id: "post-1", title: "AI 日报", slug: "ai-daily-2026-04-29", published: true },
      sourceCount: 8,
      failures: [],
      run: { id: "run-1", status: "SUCCEEDED" },
    })

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
    expect(runDailyAiNews).toHaveBeenCalledWith({ authorId: "admin-1", date: new Date("2026-04-29T00:00:00.000Z"), trigger: "cron" })
    expect(payload).toEqual({
      success: true,
      data: {
        operation: "completed",
        date: "2026-04-29",
        result: {
          operation: "created",
          published: true,
          post: { id: "post-1", title: "AI 日报", slug: "ai-daily-2026-04-29", published: true },
          sourceCount: 8,
          failures: [],
          run: { id: "run-1", status: "SUCCEEDED" },
        },
      },
    })
  })

  test("returns a failure response when the daily AI news run rejects", async () => {
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
