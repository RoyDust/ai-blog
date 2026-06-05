import { beforeEach, describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  updateAiNewsSource: vi.fn(),
  deleteAiNewsSource: vi.fn(),
}))

vi.mock("@/lib/api-auth", () => ({
  requireAdminSession: mocks.requireAdminSession,
}))

vi.mock("@/lib/ai-news-source-admin", () => ({
  updateAiNewsSource: mocks.updateAiNewsSource,
  deleteAiNewsSource: mocks.deleteAiNewsSource,
}))

describe("/api/admin/ai-news/sources/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("updates source fields", async () => {
    mocks.requireAdminSession.mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } })
    mocks.updateAiNewsSource.mockResolvedValueOnce({ id: "openai", enabled: false, weight: 100 })

    const { PATCH } = await import("../route")
    const response = await PATCH(
      new Request("http://localhost/api/admin/ai-news/sources/openai", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false, weight: 100 }),
      }),
      { params: Promise.resolve({ id: "openai" }) },
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.updateAiNewsSource).toHaveBeenCalledWith("openai", { enabled: false, weight: 100 })
    expect(payload).toEqual({ success: true, data: { id: "openai", enabled: false, weight: 100 } })
  })

  test("deletes a custom source", async () => {
    mocks.requireAdminSession.mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } })
    mocks.deleteAiNewsSource.mockResolvedValueOnce(undefined)

    const { DELETE } = await import("../route")
    const response = await DELETE(
      new Request("http://localhost/api/admin/ai-news/sources/custom", { method: "DELETE" }),
      { params: Promise.resolve({ id: "custom" }) },
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.deleteAiNewsSource).toHaveBeenCalledWith("custom")
    expect(payload).toEqual({ success: true })
  })
})
