import { beforeEach, describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => {
  const findManyAiNewsCandidate = vi.fn()
  return {
    requireAdminSession: vi.fn(),
    findManyAiNewsCandidate,
    prisma: {
      aiNewsCandidate: {
        findMany: findManyAiNewsCandidate,
      },
    },
  }
})

vi.mock("@/lib/api-auth", () => ({
  requireAdminSession: mocks.requireAdminSession,
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}))

describe("GET /api/admin/ai-news/candidates", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prisma.aiNewsCandidate = { findMany: mocks.findManyAiNewsCandidate }
  })

  test("returns candidates for a run", async () => {
    mocks.requireAdminSession.mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } })
    mocks.findManyAiNewsCandidate.mockResolvedValueOnce([
      {
        id: "candidate-1",
        runId: "run-1",
        title: "OpenAI ships an update",
        url: "https://example.com/openai",
        sourceType: "RSS",
        sourceName: "OpenAI Blog",
        selected: true,
        aiScore: 8,
        aiReason: "Important update",
        aiTags: ["model"],
        duplicateOfId: null,
        enrichment: {
          citations: [
            { title: "Launch post", url: "https://example.com/openai" },
            { title: "Discussion", url: "https://news.ycombinator.com/item?id=1" },
          ],
        },
        metadata: { discussionUrl: "https://news.ycombinator.com/item?id=1" },
        community: { discussionUrl: "https://example.com/community" },
      },
    ])

    const { GET } = await import("../route")
    const response = await GET(new Request("http://localhost/api/admin/ai-news/candidates?runId=run-1&selectedOnly=1"))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.findManyAiNewsCandidate).toHaveBeenCalledWith({
      where: { runId: "run-1", selected: true },
      orderBy: [{ selected: "desc" }, { aiScore: "desc" }, { publishedAt: "desc" }],
    })
    expect(payload).toEqual({
      success: true,
      data: [
        expect.objectContaining({
          id: "candidate-1",
          title: "OpenAI ships an update",
          url: "https://example.com/openai",
          sourceType: "RSS",
          sourceName: "OpenAI Blog",
          selected: true,
          aiScore: 8,
          aiReason: "Important update",
          aiTags: ["model"],
          duplicateOfId: null,
          citationCount: 3,
        }),
      ],
    })
  })

  test("requires runId", async () => {
    mocks.requireAdminSession.mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } })

    const { GET } = await import("../route")
    const response = await GET(new Request("http://localhost/api/admin/ai-news/candidates"))
    const payload = await response.json()

    expect(response.status).toBe(400)
    expect(payload).toEqual({ error: "runId is required" })
    expect(mocks.findManyAiNewsCandidate).not.toHaveBeenCalled()
  })
})
