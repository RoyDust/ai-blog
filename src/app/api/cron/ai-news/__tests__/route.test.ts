import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

const findFirstUser = vi.fn()
const findFirstRun = vi.fn()
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

async function flushAsyncJob() {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function authedRequest(url: string) {
  return new Request(url, {
    method: "POST",
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

  test("queues daily AI news as the oldest admin user and returns quickly", async () => {
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
    const response = await POST(authedRequest("http://localhost/api/cron/ai-news?date=2026-04-29"))
    const payload = await response.json()

    expect(response.status).toBe(202)
    expect(findFirstUser).toHaveBeenCalledWith({
      where: { role: "ADMIN" },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    })
    expect(runDailyAiNews).toHaveBeenCalledWith({ authorId: "admin-1", date: new Date("2026-04-29T00:00:00.000Z"), regenerate: false, trigger: "cron" })
    expect(payload).toEqual({ success: true, data: { operation: "queued", date: "2026-04-29" } })

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
    runDailyAiNews.mockResolvedValueOnce(runResult)

    const { POST } = await import("../route")
    const response = await POST(authedRequest("http://localhost/api/cron/ai-news?date=2026-04-29&regenerate=true"))

    expect(response.status).toBe(202)
    expect(runDailyAiNews).toHaveBeenCalledWith({
      authorId: "admin-1",
      date: new Date("2026-04-29T00:00:00.000Z"),
      regenerate: true,
      trigger: "cron",
    })
    await flushAsyncJob()
    expect(notifyDailyAiNewsSuccess).toHaveBeenCalledWith(runResult, new Date("2026-04-29T00:00:00.000Z"))
  })

  test("returns already-queued for duplicate runs on the same date", async () => {
    findFirstUser.mockResolvedValue({ id: "admin-1" })
    runDailyAiNews.mockReturnValueOnce(new Promise(() => {}))

    const { POST } = await import("../route")
    const firstResponse = await POST(authedRequest("http://localhost/api/cron/ai-news?date=2026-04-29"))
    const secondResponse = await POST(authedRequest("http://localhost/api/cron/ai-news?date=2026-04-29"))

    await expect(firstResponse.json()).resolves.toEqual({ success: true, data: { operation: "queued", date: "2026-04-29" } })
    await expect(secondResponse.json()).resolves.toEqual({ success: true, data: { operation: "already-queued", date: "2026-04-29" } })
    expect(firstResponse.status).toBe(202)
    expect(secondResponse.status).toBe(202)
    expect(runDailyAiNews).toHaveBeenCalledTimes(1)
  })

  test("records async failure notifications when the daily AI news run rejects", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)
    findFirstUser.mockResolvedValueOnce({ id: "admin-1" })
    runDailyAiNews.mockRejectedValueOnce(new Error("feed fetch failed"))

    const { POST } = await import("../route")
    const response = await POST(authedRequest("http://localhost/api/cron/ai-news?date=2026-04-29"))
    const payload = await response.json()

    expect(response.status).toBe(202)
    expect(payload).toEqual({ success: true, data: { operation: "queued", date: "2026-04-29" } })
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

    expect(response.status).toBe(500)
    expect(payload).toEqual({ error: "AI_NEWS_CRON_SECRET is not configured" })
    expect(findFirstUser).not.toHaveBeenCalled()
  })
})

describe("GET /api/cron/ai-news", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env = { ...originalEnv, AI_NEWS_CRON_SECRET: "cron-secret" }
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  test("returns pending while no cron run exists after the requested start time", async () => {
    findFirstRun.mockResolvedValueOnce(null)

    const { GET } = await import("../route")
    const response = await GET(authedRequest("http://localhost/api/cron/ai-news?date=2026-04-29&after=2026-04-29T01:00:00.000Z"))
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

  test("returns running while the latest cron run is still active", async () => {
    findFirstRun.mockResolvedValueOnce(buildRun({ status: "RUNNING", finishedAt: null }))

    const { GET } = await import("../route")
    const response = await GET(authedRequest("http://localhost/api/cron/ai-news?date=2026-04-29"))
    const payload = await response.json()

    expect(response.status).toBe(202)
    expect(payload.data.operation).toBe("running")
    expect(payload.data.run.status).toBe("RUNNING")
  })

  test("returns finished for succeeded cron runs", async () => {
    findFirstRun.mockResolvedValueOnce(buildRun())

    const { GET } = await import("../route")
    const response = await GET(authedRequest("http://localhost/api/cron/ai-news?date=2026-04-29"))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.data.operation).toBe("finished")
    expect(payload.data.run.status).toBe("SUCCEEDED")
  })

  test("returns a failing status for failed cron runs", async () => {
    findFirstRun.mockResolvedValueOnce(buildRun({ status: "FAILED", error: "feed fetch failed" }))

    const { GET } = await import("../route")
    const response = await GET(authedRequest("http://localhost/api/cron/ai-news?date=2026-04-29"))
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload.error).toBe("feed fetch failed")
    expect(payload.data.operation).toBe("failed")
  })
})
