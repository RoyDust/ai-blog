import { beforeEach, describe, expect, test, vi } from "vitest"

const requireAdminSession = vi.fn()
const runDailyAiNews = vi.fn()
const findManyAiNewsRun = vi.fn()

vi.mock("@/lib/api-auth", () => ({
  requireAdminSession,
}))

vi.mock("@/lib/ai-news", () => ({
  runDailyAiNews,
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    aiNewsRun: {
      findMany: findManyAiNewsRun,
    },
  },
}))

describe("POST /api/admin/ai-news/run", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("requires an admin session and starts a daily AI news run", async () => {
    requireAdminSession.mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } })
    runDailyAiNews.mockResolvedValueOnce({ operation: "created", published: true, post: { id: "post-1" } })

    const { POST } = await import("../route")
    const response = await POST(
      new Request("http://localhost/api/admin/ai-news/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: "2026-04-29" }),
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(runDailyAiNews).toHaveBeenCalledWith({ authorId: "admin-1", date: new Date("2026-04-29T00:00:00.000Z"), trigger: "manual" })
    expect(payload).toEqual({ success: true, data: { operation: "created", published: true, post: { id: "post-1" } } })
  })
})


describe("GET /api/admin/ai-news/run", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("returns recent AI news run records for admins", async () => {
    requireAdminSession.mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } })
    findManyAiNewsRun.mockResolvedValueOnce([
      {
        id: "run-1",
        runDate: new Date("2026-04-29T00:00:00Z"),
        trigger: "CRON",
        status: "FAILED",
        sourceCount: 0,
        failureCount: 4,
        error: "No AI news candidates available",
        postId: null,
        postTitle: null,
        postSlug: null,
        published: false,
        reviewVerdict: null,
        reviewScore: null,
        reviewSummary: null,
        startedAt: new Date("2026-04-29T01:00:00Z"),
        finishedAt: new Date("2026-04-29T01:01:00Z"),
        durationMs: 60000,
        createdAt: new Date("2026-04-29T01:00:00Z"),
      },
    ])

    const { GET } = await import("../route")
    const response = await GET()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(findManyAiNewsRun).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      take: 20,
    })
    expect(payload).toEqual({
      success: true,
      data: [
        expect.objectContaining({
          id: "run-1",
          status: "FAILED",
          trigger: "CRON",
          error: "No AI news candidates available",
          runDate: "2026-04-29T00:00:00.000Z",
        }),
      ],
    })
  })
})
