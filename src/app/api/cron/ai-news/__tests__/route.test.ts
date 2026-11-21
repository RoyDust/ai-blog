import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { ConflictError } from "@/lib/api-errors"

const findFirstUser = vi.fn()
const findFirstRun = vi.fn()
const updateManyRun = vi.fn()
const runDailyAiNews = vi.fn()
const notifyDailyAiNewsSuccess = vi.fn()
const notifyDailyAiNewsFailure = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: findFirstUser,
    },
    aiNewsRun: {
      findFirst: findFirstRun,
      updateMany: updateManyRun,
    },
  },
}))

vi.mock("@/lib/ai-news", () => ({
  runDailyAiNews,
  notifyDailyAiNewsSuccess,
  notifyDailyAiNewsFailure,
}))

async function flushAsyncJob() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function authedRequest(url: string, method = "POST") {
  return new Request(url, {
    method,
    headers: { Authorization: "Bearer cron-secret" },
  })
}

function buildRun(overrides: Record<string, unknown> = {}) {
  return {
    id: "run-1",
    runDate: new Date("2026-04-29T00:00:00.000Z"),
    createdAt: new Date("2026-04-29T01:00:02.000Z"),
    finishedAt: new Date("2026-04-29T01:02:00.000Z"),
    status: "SUCCEEDED",
    postId: "post-1",
    postTitle: "AI 日报",
    postSlug: "ai-daily-2026-04-29",
    published: true,
    sourceCount: 8,
    selectedCandidateCount: 6,
    qualityScore: 86,
    citationCoverage: 1,
    generationMode: "candidate-pipeline",
    reviewVerdict: "ready",
    reviewScore: 90,
    reviewSummary: "Ready",
    error: null,
    ...overrides,
  }
}

describe("POST /api/cron/ai-news", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    updateManyRun.mockResolvedValue({ count: 0 })
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

  test("persists RUNNING runId synchronously before returning 202 and completes in the background", async () => {
    findFirstUser.mockResolvedValueOnce({ id: "admin-1" })
    let finishBackgroundWork!: () => void
    const backgroundBarrier = new Promise<void>((resolve) => {
      finishBackgroundWork = resolve
    })
    let runPersistedBeforeResponse = false

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
    runDailyAiNews.mockImplementationOnce(async (options: { onRunCreated?: (run: { id: string; status: "RUNNING" }) => void }) => {
      runPersistedBeforeResponse = true
      options.onRunCreated?.({ id: "run-1", status: "RUNNING" })
      await backgroundBarrier
      return runResult
    })

    const { POST } = await import("../route")
    const response = await POST(authedRequest("http://localhost/api/cron/ai-news?date=2026-04-29"))
    const payload = await response.json()

    expect(runPersistedBeforeResponse).toBe(true)
    expect(response.status).toBe(202)
    expect(findFirstUser).toHaveBeenCalledWith({
      where: { role: "ADMIN" },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    })
    expect(runDailyAiNews).toHaveBeenCalledWith(
      expect.objectContaining({
        authorId: "admin-1",
        date: new Date("2026-04-29T00:00:00.000Z"),
        regenerate: false,
        trigger: "cron",
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
    expect(notifyDailyAiNewsSuccess).not.toHaveBeenCalled()

    finishBackgroundWork()
    await flushAsyncJob()
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
    runDailyAiNews.mockImplementationOnce(async (options: { onRunCreated?: (run: { id: string; status: "RUNNING" }) => void }) => {
      options.onRunCreated?.({ id: "run-1", status: "RUNNING" })
      return runResult
    })

    const { POST } = await import("../route")
    const response = await POST(authedRequest("http://localhost/api/cron/ai-news?date=2026-04-29&regenerate=true"))
    const payload = await response.json()

    expect(response.status).toBe(202)
    expect(payload.data.runId).toBe("run-1")
    expect(runDailyAiNews).toHaveBeenCalledWith(
      expect.objectContaining({
        authorId: "admin-1",
        date: new Date("2026-04-29T00:00:00.000Z"),
        regenerate: true,
        trigger: "cron",
      }),
    )
    await flushAsyncJob()
    expect(notifyDailyAiNewsSuccess).toHaveBeenCalledWith(runResult, new Date("2026-04-29T00:00:00.000Z"))
  })

  test("returns already-running with active runId when another run for the same date holds the lock", async () => {
    findFirstUser.mockResolvedValue({ id: "admin-1" })
    runDailyAiNews
      .mockImplementationOnce((options: { onRunCreated?: (run: { id: string; status: "RUNNING" }) => void }) => {
        options.onRunCreated?.({ id: "run-active-1", status: "RUNNING" })
        return new Promise(() => {})
      })
      .mockRejectedValueOnce(
        Object.assign(new ConflictError("Daily AI news is already running for this date"), {
          code: "AI_NEWS_ALREADY_RUNNING",
          runId: "run-active-1",
        }),
      )

    const { POST } = await import("../route")
    const firstResponse = await POST(authedRequest("http://localhost/api/cron/ai-news?date=2026-04-29"))
    const secondResponse = await POST(authedRequest("http://localhost/api/cron/ai-news?date=2026-04-29"))

    await expect(firstResponse.json()).resolves.toEqual({
      success: true,
      data: {
        operation: "queued",
        runId: "run-active-1",
        date: "2026-04-29",
        run: { id: "run-active-1", status: "RUNNING" },
      },
    })
    await expect(secondResponse.json()).resolves.toEqual({
      success: true,
      data: {
        operation: "already-running",
        runId: "run-active-1",
        date: "2026-04-29",
        run: { id: "run-active-1", status: "RUNNING" },
      },
    })
    expect(firstResponse.status).toBe(202)
    expect(secondResponse.status).toBe(202)
  })

  test("records async failure notifications when the daily AI news run rejects after startup", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
    findFirstUser.mockResolvedValueOnce({ id: "admin-1" })
    runDailyAiNews.mockImplementationOnce(async (options: { onRunCreated?: (run: { id: string; status: "RUNNING" }) => void }) => {
      options.onRunCreated?.({ id: "run-fail-1", status: "RUNNING" })
      await Promise.resolve()
      throw new Error("feed fetch failed")
    })

    const { POST } = await import("../route")
    const response = await POST(authedRequest("http://localhost/api/cron/ai-news?date=2026-04-29"))
    const payload = await response.json()

    expect(response.status).toBe(202)
    expect(payload).toEqual({
      success: true,
      data: {
        operation: "queued",
        runId: "run-fail-1",
        date: "2026-04-29",
        run: { id: "run-fail-1", status: "RUNNING" },
      },
    })
    await flushAsyncJob()
    expect(notifyDailyAiNewsFailure).toHaveBeenCalledWith(new Date("2026-04-29T00:00:00.000Z"), expect.any(Error))
    expect(consoleError).toHaveBeenCalledWith("Daily AI news cron failed:", expect.any(Error))
    consoleError.mockRestore()
  })

  test("fails closed when the cron secret is not configured", async () => {
    delete process.env.AI_NEWS_CRON_SECRET

    const { POST } = await import("../route")
    const response = await POST(authedRequest("http://localhost/api/cron/ai-news"))
    const payload = await response.json()

    expect(response.status).toBe(503)
    expect(payload).toEqual({ error: "Internal service secret is not configured" })
    expect(findFirstUser).not.toHaveBeenCalled()
  })
})

describe("GET /api/cron/ai-news", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    updateManyRun.mockResolvedValue({ count: 0 })
    process.env = { ...originalEnv, AI_NEWS_CRON_SECRET: "cron-secret" }
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  test("polls exact run status by runId and runs stale RUNNING reaper first", async () => {
    findFirstRun
      .mockResolvedValueOnce(buildRun({ id: "run-42", status: "RUNNING", finishedAt: null }))
      .mockResolvedValueOnce(buildRun({ id: "run-42", status: "SUCCEEDED" }))

    const { GET } = await import("../route")
    const runningRes = await GET(authedRequest("http://localhost/api/cron/ai-news?runId=run-42", "GET"))
    const runningPayload = await runningRes.json()

    expect(updateManyRun).toHaveBeenCalledWith({
      where: {
        status: "RUNNING",
        startedAt: { lte: expect.any(Date) },
      },
      data: {
        status: "FAILED",
        error: "Stale RUNNING AI news run reaped after process interruption",
        finishedAt: expect.any(Date),
      },
    })
    expect(findFirstRun).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run-42" },
      }),
    )
    expect(runningRes.status).toBe(202)
    expect(runningPayload.data).toMatchObject({
      operation: "running",
      runId: "run-42",
      date: "2026-04-29",
    })

    const finishedRes = await GET(authedRequest("http://localhost/api/cron/ai-news?runId=run-42", "GET"))
    const finishedPayload = await finishedRes.json()
    expect(finishedRes.status).toBe(200)
    expect(finishedPayload.data).toMatchObject({
      operation: "finished",
      runId: "run-42",
      date: "2026-04-29",
    })
  })

  test("returns 404 when an explicit runId does not exist", async () => {
    findFirstRun.mockResolvedValueOnce(null)

    const { GET } = await import("../route")
    const response = await GET(authedRequest("http://localhost/api/cron/ai-news?runId=missing-run", "GET"))

    expect(response.status).toBe(404)
  })

  test("returns pending while no cron run exists after the requested start time", async () => {
    findFirstRun.mockResolvedValueOnce(null)

    const { GET } = await import("../route")
    const response = await GET(authedRequest("http://localhost/api/cron/ai-news?date=2026-04-29&after=2026-04-29T01:00:00.000Z", "GET"))
    const payload = await response.json()

    expect(response.status).toBe(202)
    expect(payload).toEqual({ success: true, data: { operation: "pending", date: "2026-04-29", status: "PENDING" } })
    expect(findFirstRun).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        trigger: "CRON",
        createdAt: { gte: new Date("2026-04-29T01:00:00.000Z") },
        runDate: { gte: new Date("2026-04-29T00:00:00.000Z"), lt: new Date("2026-04-30T00:00:00.000Z") },
      }),
    }))
  })

  test("returns a failing status for failed or reaped stale cron runs", async () => {
    findFirstRun.mockResolvedValueOnce(
      buildRun({
        id: "run-stale",
        status: "FAILED",
        error: "Stale RUNNING AI news run reaped after process interruption",
      }),
    )

    const { GET } = await import("../route")
    const response = await GET(authedRequest("http://localhost/api/cron/ai-news?runId=run-stale", "GET"))
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload.error).toBe("Stale RUNNING AI news run reaped after process interruption")
    expect(payload.data.operation).toBe("failed")
    expect(payload.data.runId).toBe("run-stale")
  })
})
