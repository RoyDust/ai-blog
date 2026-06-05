import { beforeEach, describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  testAiNewsSource: vi.fn(),
}))

vi.mock("@/lib/api-auth", () => ({
  requireAdminSession: mocks.requireAdminSession,
}))

vi.mock("@/lib/ai-news-source-admin", () => ({
  testAiNewsSource: mocks.testAiNewsSource,
}))

describe("POST /api/admin/ai-news/sources/[id]/test", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("returns source test results", async () => {
    mocks.requireAdminSession.mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } })
    mocks.testAiNewsSource.mockResolvedValueOnce({
      status: "success",
      itemCount: 2,
      sampleItems: [{ title: "Item", url: "https://example.com/item" }],
      message: "来源可用，最近 48 小时抓到 2 条候选。",
      testedAt: new Date("2026-05-31T00:00:00Z"),
    })

    const { POST } = await import("../route")
    const response = await POST(
      new Request("http://localhost/api/admin/ai-news/sources/openai/test", { method: "POST" }),
      { params: Promise.resolve({ id: "openai" }) },
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.testAiNewsSource).toHaveBeenCalledWith("openai")
    expect(payload).toEqual({
      success: true,
      data: {
        status: "success",
        itemCount: 2,
        sampleItems: [{ title: "Item", url: "https://example.com/item" }],
        message: "来源可用，最近 48 小时抓到 2 条候选。",
        testedAt: "2026-05-31T00:00:00.000Z",
      },
    })
  })
})
