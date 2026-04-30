import { beforeEach, describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const findManyAiNewsRun = vi.fn()
  const queryRawUnsafe = vi.fn()
  return {
    requireAdminSession: vi.fn(),
    runDailyAiNews: vi.fn(),
    findManyAiNewsRun,
    queryRawUnsafe,
    prisma: {
      aiNewsRun: {
        findMany: findManyAiNewsRun,
      } as { findMany: typeof findManyAiNewsRun } | undefined,
      $queryRawUnsafe: queryRawUnsafe,
    },
  }
})

vi.mock("@/lib/api-auth", () => ({
  requireAdminSession: mocks.requireAdminSession,
}))

vi.mock("@/lib/ai-news", () => ({
  runDailyAiNews: mocks.runDailyAiNews,
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}))

describe("POST /api/admin/ai-news/run", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prisma.aiNewsRun = { findMany: mocks.findManyAiNewsRun }
  })

  test("requires an admin session and starts a daily AI news run", async () => {
    mocks.requireAdminSession.mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } })
    mocks.runDailyAiNews.mockResolvedValueOnce({ operation: "created", published: true, post: { id: "post-1" } })

    const { POST } = await import("../route")
    const response = await POST(
      new Request("http://localhost/api/admin/ai-news/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: "2026-04-29", modelId: "model-1" }),
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.runDailyAiNews).toHaveBeenCalledWith({ authorId: "admin-1", date: new Date("2026-04-29T00:00:00.000Z"), modelId: "model-1", regenerate: false, trigger: "manual" })
    expect(payload).toEqual({ success: true, data: { operation: "created", published: true, post: { id: "post-1" } } })
  })

  test("passes the regenerate flag through for existing daily posts", async () => {
    mocks.requireAdminSession.mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } })
    mocks.runDailyAiNews.mockResolvedValueOnce({ operation: "regenerated", published: true, post: { id: "post-1" } })

    const { POST } = await import("../route")
    const response = await POST(
      new Request("http://localhost/api/admin/ai-news/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: "2026-04-29", modelId: "model-1", regenerate: true }),
      }),
    )

    expect(response.status).toBe(200)
    expect(mocks.runDailyAiNews).toHaveBeenCalledWith({
      authorId: "admin-1",
      date: new Date("2026-04-29T00:00:00.000Z"),
      modelId: "model-1",
      regenerate: true,
      trigger: "manual",
    })
  })
})


describe("GET /api/admin/ai-news/run", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prisma.aiNewsRun = { findMany: mocks.findManyAiNewsRun }
  })

  test("returns recent AI news run records for admins", async () => {
    mocks.requireAdminSession.mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } })
    mocks.findManyAiNewsRun.mockResolvedValueOnce([
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
    expect(mocks.findManyAiNewsRun).toHaveBeenCalledWith({
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

  test("falls back to raw SQL when the running Prisma client is stale", async () => {
    mocks.prisma.aiNewsRun = undefined
    mocks.requireAdminSession.mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } })
    mocks.queryRawUnsafe.mockResolvedValueOnce([
      {
        id: "run-raw-1",
        runDate: new Date("2026-04-29T00:00:00Z"),
        trigger: "MANUAL",
        status: "SUCCEEDED",
        sourceCount: 12,
        failureCount: 0,
        error: null,
        postId: "post-1",
        postTitle: "AI 日报",
        postSlug: "ai-daily-2026-04-29",
        published: true,
        reviewVerdict: "ready",
        reviewScore: 92,
        reviewSummary: "可以发布",
        startedAt: new Date("2026-04-29T01:00:00Z"),
        finishedAt: new Date("2026-04-29T01:02:00Z"),
        durationMs: 120000,
        createdAt: new Date("2026-04-29T01:00:00Z"),
        updatedAt: new Date("2026-04-29T01:02:00Z"),
      },
    ])

    const { GET } = await import("../route")
    const response = await GET()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.findManyAiNewsRun).not.toHaveBeenCalled()
    expect(mocks.queryRawUnsafe).toHaveBeenCalledWith(expect.stringContaining('FROM "ai_news_runs"'))
    expect(payload.data[0]).toMatchObject({
      id: "run-raw-1",
      status: "SUCCEEDED",
      postSlug: "ai-daily-2026-04-29",
      runDate: "2026-04-29T00:00:00.000Z",
    })
  })
})
