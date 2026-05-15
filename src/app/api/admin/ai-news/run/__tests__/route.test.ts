import { beforeEach, describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const findManyAiNewsRun = vi.fn()
  return {
    requireAdminSession: vi.fn(),
    runDailyAiNews: vi.fn(),
    createAdminNotification: vi.fn(),
    findManyAiNewsRun,
    prisma: {
      aiNewsRun: {
        findMany: findManyAiNewsRun,
      },
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

vi.mock("@/lib/notifications", () => ({
  createAdminNotification: mocks.createAdminNotification,
  NOTIFICATION_SEVERITIES: {
    success: "SUCCESS",
    error: "ERROR",
  },
  NOTIFICATION_TYPES: {
    aiNewsSucceeded: "AI_NEWS_SUCCEEDED",
    aiNewsFailed: "AI_NEWS_FAILED",
  },
}))

describe("POST /api/admin/ai-news/run", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("requires an admin session and starts a daily AI news run", async () => {
    mocks.requireAdminSession.mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } })
    mocks.runDailyAiNews.mockResolvedValueOnce({
      operation: "created",
      published: true,
      post: { id: "post-1", title: "AI 日报", slug: "ai-daily-2026-04-29" },
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
    })

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
    expect(payload).toEqual({
      success: true,
      data: {
        operation: "created",
        published: true,
          post: { id: "post-1", title: "AI 日报", slug: "ai-daily-2026-04-29" },
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
      },
    })
    expect(mocks.createAdminNotification).toHaveBeenCalledWith(expect.objectContaining({
      type: "AI_NEWS_SUCCEEDED",
      severity: "SUCCESS",
      title: "AI 日报已上线",
      actionUrl: "/admin/posts/post-1/edit",
      entityType: "aiNewsRun",
      entityId: "run-1",
      dedupeKey: "ai-news-run:run-1:SUCCEEDED",
    }))
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

  test("creates a failure notification when generation fails after validation", async () => {
    mocks.requireAdminSession.mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } })
    mocks.runDailyAiNews.mockRejectedValueOnce(new Error("No AI news candidates available"))

    const { POST } = await import("../route")
    const response = await POST(
      new Request("http://localhost/api/admin/ai-news/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: "2026-04-29", modelId: "model-1" }),
      }),
    )

    expect(response.status).toBe(500)
    expect(mocks.createAdminNotification).toHaveBeenCalledWith(expect.objectContaining({
      type: "AI_NEWS_FAILED",
      severity: "ERROR",
      title: "AI 日报生成失败",
      body: "No AI news candidates available",
      actionUrl: "/admin/ai-news",
      dedupeKey: "ai-news:2026-04-29:FAILED",
    }))
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
        rawCandidateCount: 5,
        dedupedCandidateCount: 4,
        scoredCandidateCount: 4,
        selectedCandidateCount: 0,
        sourceFailureJson: [{ sourceId: "broken", stage: "fetch", message: "HTTP 500" }],
        qualityScore: 0,
        citationCoverage: 0,
        generationMode: "fallback",
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
          rawCandidateCount: 5,
          dedupedCandidateCount: 4,
          scoredCandidateCount: 4,
          selectedCandidateCount: 0,
          sourceFailureJson: [{ sourceId: "broken", stage: "fetch", message: "HTTP 500" }],
          qualityScore: 0,
          citationCoverage: 0,
          generationMode: "fallback",
          runDate: "2026-04-29T00:00:00.000Z",
        }),
      ],
    })
  })
})
