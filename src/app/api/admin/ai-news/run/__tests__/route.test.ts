import { beforeEach, describe, expect, test, vi } from "vitest"
import { ConflictError } from "@/lib/api-errors"

const mocks = vi.hoisted(() => {
  const findManyAiNewsRun = vi.fn()
  const findFirstAiNewsRun = vi.fn()
  const updateManyAiNewsRun = vi.fn()
  return {
    requireAdminSession: vi.fn(),
    runDailyAiNews: vi.fn(),
    createAdminNotification: vi.fn(),
    findManyAiNewsRun,
    findFirstAiNewsRun,
    updateManyAiNewsRun,
    prisma: {
      aiNewsRun: {
        findMany: findManyAiNewsRun,
        findFirst: findFirstAiNewsRun,
        updateMany: updateManyAiNewsRun,
      },
    },
  }
})

vi.mock("@/lib/api-auth", () => ({
  requireAdminSession: mocks.requireAdminSession,
}))

vi.mock("@/lib/ai-news", async () => {
  const notifications = await vi.importActual<typeof import("@/lib/ai-news/notifications")>(
    "@/lib/ai-news/notifications",
  )
  return {
    ...notifications,
    runDailyAiNews: mocks.runDailyAiNews,
  }
})

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

async function flushAsyncJob() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe("POST /api/admin/ai-news/run", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.updateManyAiNewsRun.mockResolvedValue({ count: 0 })
  })

  test("persists RUNNING runId synchronously before returning 202 and sends notification on completion", async () => {
    mocks.requireAdminSession.mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } })
    let releaseBackground!: () => void
    const backgroundGate = new Promise<void>((resolve) => {
      releaseBackground = resolve
    })
    let persistedBefore202 = false

    mocks.runDailyAiNews.mockImplementationOnce(
      async (options: { onRunCreated?: (run: { id: string; status: "RUNNING" }) => void }) => {
        persistedBefore202 = true
        options.onRunCreated?.({ id: "run-1", status: "RUNNING" })
        await backgroundGate
        return {
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
        }
      },
    )

    const { POST } = await import("../route")
    const response = await POST(
      new Request("http://localhost/api/admin/ai-news/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: "2026-04-29", modelId: "model-1" }),
      }),
    )
    const payload = await response.json()

    expect(persistedBefore202).toBe(true)
    expect(response.status).toBe(202)
    expect(mocks.runDailyAiNews).toHaveBeenCalledWith(
      expect.objectContaining({
        authorId: "admin-1",
        date: new Date("2026-04-29T00:00:00.000Z"),
        modelId: "model-1",
        regenerate: false,
        trigger: "manual",
        onRunCreated: expect.any(Function),
      }),
    )
    expect(payload).toEqual({
      success: true,
      data: {
        operation: "queued",
        runId: "run-1",
        date: "2026-04-29",
        run: { id: "run-1", status: "RUNNING" },
      },
    })
    expect(mocks.createAdminNotification).not.toHaveBeenCalled()

    releaseBackground()
    await flushAsyncJob()

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

  test("rejects synchronously with 409 when regenerate hits a manual post or active date lock", async () => {
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } })
    mocks.runDailyAiNews
      .mockRejectedValueOnce(new ConflictError("Daily AI news slug is occupied by a manual post"))
      .mockRejectedValueOnce(
        Object.assign(new ConflictError("Daily AI news is already running for this date"), {
          code: "AI_NEWS_ALREADY_RUNNING",
          runId: "run-active-1",
        }),
      )

    const { POST } = await import("../route")

    const manualConflictResponse = await POST(
      new Request("http://localhost/api/admin/ai-news/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: "2026-04-29", modelId: "model-1", regenerate: true }),
      }),
    )
    expect(manualConflictResponse.status).toBe(409)
    await expect(manualConflictResponse.json()).resolves.toEqual({
      error: "Daily AI news slug is occupied by a manual post",
    })

    mocks.createAdminNotification.mockClear()
    const alreadyRunningResponse = await POST(
      new Request("http://localhost/api/admin/ai-news/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: "2026-04-29", modelId: "model-1" }),
      }),
    )
    expect(alreadyRunningResponse.status).toBe(409)
    await expect(alreadyRunningResponse.json()).resolves.toEqual({
      error: "Daily AI news is already running for this date",
    })
    expect(mocks.createAdminNotification).not.toHaveBeenCalled()
  })

  test("passes selected source ids through for manual runs", async () => {
    mocks.requireAdminSession.mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } })
    mocks.runDailyAiNews.mockImplementationOnce(
      async (options: { onRunCreated?: (run: { id: string; status: "RUNNING" }) => void }) => {
        options.onRunCreated?.({ id: "run-1", status: "RUNNING" })
        return {
          operation: "created",
          published: false,
          post: { id: "post-1", title: "AI 日报", slug: "ai-daily-2026-04-29" },
          run: { id: "run-1", status: "SUCCEEDED" },
        }
      },
    )

    const { POST } = await import("../route")
    const response = await POST(
      new Request("http://localhost/api/admin/ai-news/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: "2026-04-29", modelId: "model-1", sourceMode: "selected", sourceIds: ["openai", "openai", "disabled"] }),
      }),
    )

    expect(response.status).toBe(202)
    expect(mocks.runDailyAiNews).toHaveBeenCalledWith(
      expect.objectContaining({
        authorId: "admin-1",
        date: new Date("2026-04-29T00:00:00.000Z"),
        modelId: "model-1",
        regenerate: false,
        trigger: "manual",
        sourceMode: "selected",
        sourceIds: ["openai", "disabled"],
      }),
    )
    await flushAsyncJob()
  })

  test("creates a failure notification when background generation fails after 202 acceptance", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
    mocks.requireAdminSession.mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } })
    mocks.runDailyAiNews.mockImplementationOnce(
      async (options: { onRunCreated?: (run: { id: string; status: "RUNNING" }) => void }) => {
        options.onRunCreated?.({ id: "run-1", status: "RUNNING" })
        await Promise.resolve()
        throw new Error("No AI news candidates available")
      },
    )

    const { POST } = await import("../route")
    const response = await POST(
      new Request("http://localhost/api/admin/ai-news/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: "2026-04-29", modelId: "model-1" }),
      }),
    )

    expect(response.status).toBe(202)
    await flushAsyncJob()
    expect(mocks.createAdminNotification).toHaveBeenCalledWith(expect.objectContaining({
      type: "AI_NEWS_FAILED",
      severity: "ERROR",
      title: "AI 日报生成失败",
      body: "No AI news candidates available",
      actionUrl: "/admin/ai-news",
      dedupeKey: "ai-news:2026-04-29:FAILED",
    }))
    consoleError.mockRestore()
  })

  test("allows empty POST body to default to {} while rejecting malformed non-empty JSON with 400", async () => {
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } })
    mocks.runDailyAiNews.mockImplementationOnce(
      async (options: { onRunCreated?: (run: { id: string; status: "RUNNING" }) => void }) => {
        options.onRunCreated?.({ id: "run-empty-body", status: "RUNNING" })
        return {
          operation: "created",
          published: false,
          post: { id: "post-1", title: "AI 日报", slug: "ai-daily-2026-04-29" },
          run: { id: "run-empty-body", status: "SUCCEEDED" },
        }
      },
    )

    const { POST } = await import("../route")
    const emptyBodyRes = await POST(
      new Request("http://localhost/api/admin/ai-news/run", {
        method: "POST",
        body: "",
      }),
    )
    expect(emptyBodyRes.status).toBe(202)
    await flushAsyncJob()

    mocks.runDailyAiNews.mockClear()
    const badJsonRes = await POST(
      new Request("http://localhost/api/admin/ai-news/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{bad-json",
      }),
    )
    expect(badJsonRes.status).toBe(400)
    await expect(badJsonRes.json()).resolves.toEqual({ error: "Invalid JSON body" })

    const arrayJsonRes = await POST(
      new Request("http://localhost/api/admin/ai-news/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "[]",
      }),
    )
    expect(arrayJsonRes.status).toBe(400)
    await expect(arrayJsonRes.json()).resolves.toEqual({ error: "Invalid JSON body" })
    expect(mocks.runDailyAiNews).not.toHaveBeenCalled()
  })
})

describe("GET /api/admin/ai-news/run", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.updateManyAiNewsRun.mockResolvedValue({ count: 0 })
  })

  test("returns recent AI news run records for admins and reaps stale RUNNING rows", async () => {
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
    expect(mocks.updateManyAiNewsRun).toHaveBeenCalledWith({
      where: {
        status: "RUNNING",
        updatedAt: { lte: expect.any(Date) },
      },
      data: {
        status: "FAILED",
        error: "Stale RUNNING AI news run reaped after process interruption",
        finishedAt: expect.any(Date),
      },
    })
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

  test("polls a specific run by runId with 202 while RUNNING and 200 once finished", async () => {
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } })
    mocks.findFirstAiNewsRun
      .mockResolvedValueOnce({ id: "run-99", status: "RUNNING" })
      .mockResolvedValueOnce({
        id: "run-99",
        status: "SUCCEEDED",
        postId: "post-99",
        postSlug: "ai-daily-2026-04-29",
        published: true,
      })

    const { GET } = await import("../route")
    const runningRes = await GET(new Request("http://localhost/api/admin/ai-news/run?runId=run-99"))
    expect(runningRes.status).toBe(202)

    const doneRes = await GET(new Request("http://localhost/api/admin/ai-news/run?runId=run-99"))
    expect(doneRes.status).toBe(200)
    await expect(doneRes.json()).resolves.toEqual({
      success: true,
      data: {
        id: "run-99",
        status: "SUCCEEDED",
        postId: "post-99",
        postSlug: "ai-daily-2026-04-29",
        published: true,
      },
    })
  })
})
