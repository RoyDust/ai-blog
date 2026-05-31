import { beforeEach, describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  listAiNewsSources: vi.fn(),
  createAiNewsSource: vi.fn(),
}))

vi.mock("@/lib/api-auth", () => ({
  requireAdminSession: mocks.requireAdminSession,
}))

vi.mock("@/lib/ai-news-source-admin", () => ({
  listAiNewsSources: mocks.listAiNewsSources,
  createAiNewsSource: mocks.createAiNewsSource,
}))

describe("/api/admin/ai-news/sources", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("returns AI news sources for admins", async () => {
    mocks.requireAdminSession.mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } })
    mocks.listAiNewsSources.mockResolvedValueOnce({
      sources: [{ id: "openai", name: "OpenAI Blog", type: "RSS", settings: {}, deletable: false }],
      pagination: { page: 2, limit: 20, total: 31, totalPages: 2 },
      summary: { enabledCount: 12, enabledSourceIds: ["openai"] },
    })

    const { GET } = await import("../route")
    const response = await GET(new Request("http://localhost/api/admin/ai-news/sources?page=2&limit=20&q=openai&category=official"))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.listAiNewsSources).toHaveBeenCalledWith({
      page: 2,
      limit: 20,
      query: "openai",
      category: "official",
    })
    expect(payload).toEqual({
      success: true,
      data: [{ id: "openai", name: "OpenAI Blog", type: "RSS", settings: {}, deletable: false }],
      pagination: { page: 2, limit: 20, total: 31, totalPages: 2 },
      summary: { enabledCount: 12, enabledSourceIds: ["openai"] },
    })
  })

  test("creates an RSS source", async () => {
    mocks.requireAdminSession.mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } })
    mocks.createAiNewsSource.mockResolvedValueOnce({ id: "example-ai-blog", name: "Example AI Blog" })

    const { POST } = await import("../route")
    const response = await POST(new Request("http://localhost/api/admin/ai-news/sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "RSS", name: "Example AI Blog", url: "https://example.com/feed.xml" }),
    }))
    const payload = await response.json()

    expect(response.status).toBe(201)
    expect(mocks.createAiNewsSource).toHaveBeenCalledWith({
      type: "RSS",
      name: "Example AI Blog",
      url: "https://example.com/feed.xml",
    })
    expect(payload).toEqual({ success: true, data: { id: "example-ai-blog", name: "Example AI Blog" } })
  })
})
