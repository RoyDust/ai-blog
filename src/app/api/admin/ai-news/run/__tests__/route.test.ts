import { beforeEach, describe, expect, test, vi } from "vitest"

const requireAdminSession = vi.fn()
const runDailyAiNews = vi.fn()

vi.mock("@/lib/api-auth", () => ({
  requireAdminSession,
}))

vi.mock("@/lib/ai-news", () => ({
  runDailyAiNews,
}))

describe("POST /api/admin/ai-news/run", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("requires an admin session and starts a daily AI news run", async () => {
    requireAdminSession.mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } })
    runDailyAiNews.mockResolvedValueOnce({ operation: "created", published: true, post: { id: "post-1" } })

    const { POST } = await import("../route")
    const response = await POST(
      new Request("http://localhost/api/admin/ai-news/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: "2026-04-29" }),
      }),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(runDailyAiNews).toHaveBeenCalledWith({ authorId: "admin-1", date: new Date("2026-04-29T00:00:00.000Z") })
    expect(payload).toEqual({ success: true, data: { operation: "created", published: true, post: { id: "post-1" } } })
  })
})
