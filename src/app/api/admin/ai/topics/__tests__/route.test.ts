import { beforeEach, describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  listAiTopics: vi.fn(),
  materializeTopicsFromRecentCandidates: vi.fn(),
  getAiTopic: vi.fn(),
  updateAiTopic: vi.fn(),
  createDraftFromTopic: vi.fn(),
}))

vi.mock("@/lib/api-auth", () => ({
  requireAdminSession: mocks.requireAdminSession,
}))

vi.mock("@/lib/ai-topic-radar", () => ({
  listAiTopics: mocks.listAiTopics,
  materializeTopicsFromRecentCandidates: mocks.materializeTopicsFromRecentCandidates,
  getAiTopic: mocks.getAiTopic,
  updateAiTopic: mocks.updateAiTopic,
  createDraftFromTopic: mocks.createDraftFromTopic,
}))

describe("admin AI topics routes", () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } })
    mocks.listAiTopics.mockResolvedValue([])
    mocks.materializeTopicsFromRecentCandidates.mockResolvedValue([])
    mocks.getAiTopic.mockResolvedValue({ id: "topic-1" })
    mocks.updateAiTopic.mockResolvedValue({ id: "topic-1", status: "WATCHING" })
    mocks.createDraftFromTopic.mockResolvedValue({ id: "post-1", published: false })
  })

  test("rejects non-admin topic list requests", async () => {
    const { ForbiddenError } = await import("@/lib/api-errors")
    mocks.requireAdminSession.mockRejectedValueOnce(new ForbiddenError())

    const { GET } = await import("../route")
    const response = await GET(new Request("http://localhost/api/admin/ai/topics"))

    expect(response.status).toBe(403)
    expect(mocks.listAiTopics).not.toHaveBeenCalled()
  })

  test("returns topic cards filtered by status", async () => {
    mocks.listAiTopics.mockResolvedValueOnce([
      { id: "topic-1", title: "AI Agent", status: "NEW", heat: 28, score: 8, sourceCount: 2, candidates: [] },
    ])

    const { GET } = await import("../route")
    const response = await GET(new Request("http://localhost/api/admin/ai/topics?status=NEW"))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.listAiTopics).toHaveBeenCalledWith({ status: "NEW" })
    expect(payload).toEqual({
      success: true,
      data: [
        expect.objectContaining({ id: "topic-1", title: "AI Agent" }),
      ],
    })
  })

  test("materializes topics from recent candidates", async () => {
    mocks.materializeTopicsFromRecentCandidates.mockResolvedValueOnce([{ tag: "ai-agent", candidateIds: ["c1"] }])

    const { POST } = await import("../route")
    const response = await POST(
      new Request("http://localhost/api/admin/ai/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: 14, excludeSelected: true }),
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.materializeTopicsFromRecentCandidates).toHaveBeenCalledWith({ days: 14, excludeSelected: true })
    expect(payload).toEqual({ success: true, data: [{ tag: "ai-agent", candidateIds: ["c1"] }] })
  })

  test("loads topic detail", async () => {
    const { GET } = await import("../[id]/route")
    const response = await GET(new Request("http://localhost/api/admin/ai/topics/topic-1"), {
      params: Promise.resolve({ id: "topic-1" }),
    })

    expect(response.status).toBe(200)
    expect(mocks.getAiTopic).toHaveBeenCalledWith("topic-1")
  })

  test("updates topic status and note fields", async () => {
    const { PATCH } = await import("../[id]/route")
    const response = await PATCH(
      new Request("http://localhost/api/admin/ai/topics/topic-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PLANNED", summary: "摘要", angle: "角度" }),
      }),
      { params: Promise.resolve({ id: "topic-1" }) },
    )

    expect(response.status).toBe(200)
    expect(mocks.updateAiTopic).toHaveBeenCalledWith("topic-1", { status: "PLANNED", summary: "摘要", angle: "角度" })
  })

  test("archives a topic with DELETE", async () => {
    const { DELETE } = await import("../[id]/route")
    const response = await DELETE(new Request("http://localhost/api/admin/ai/topics/topic-1", { method: "DELETE" }), {
      params: Promise.resolve({ id: "topic-1" }),
    })

    expect(response.status).toBe(200)
    expect(mocks.updateAiTopic).toHaveBeenCalledWith("topic-1", { status: "ARCHIVED" })
  })

  test("creates an unpublished draft from a topic", async () => {
    const { POST } = await import("../[id]/draft/route")
    const response = await POST(new Request("http://localhost/api/admin/ai/topics/topic-1/draft", { method: "POST" }), {
      params: Promise.resolve({ id: "topic-1" }),
    })
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.createDraftFromTopic).toHaveBeenCalledWith("topic-1", "admin-1")
    expect(payload).toEqual({ success: true, data: { id: "post-1", published: false } })
  })
})
