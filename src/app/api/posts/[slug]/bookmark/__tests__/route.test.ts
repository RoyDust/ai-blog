import { beforeEach, describe, expect, test, vi } from "vitest"

const getServerSession = vi.fn()
const checkInteractionRateLimit = vi.fn()

vi.mock("next-auth", () => ({
  getServerSession,
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@/lib/rate-limit", () => ({
  checkInteractionRateLimit,
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findFirst: vi.fn(),
    },
    bookmark: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
  },
}))

describe("POST /api/posts/[slug]/bookmark", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("returns 429 when the interaction limiter rejects the request", async () => {
    checkInteractionRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, strategy: "database" })

    const { POST } = await import("../route")
    const response = await POST(new Request("http://localhost/api/posts/test-post/bookmark", { method: "POST" }), {
      params: Promise.resolve({ slug: "test-post" }),
    })
    const payload = await response.json()

    expect(response.status).toBe(429)
    expect(payload).toEqual({ error: "Too many requests" })
    expect(getServerSession).not.toHaveBeenCalled()
  })

  test("continues to auth check after an allowed interaction limit result", async () => {
    checkInteractionRateLimit.mockResolvedValueOnce({ allowed: true, remaining: 19, strategy: "database" })
    getServerSession.mockResolvedValueOnce(null)

    const { POST } = await import("../route")
    const response = await POST(new Request("http://localhost/api/posts/test-post/bookmark", { method: "POST" }), {
      params: Promise.resolve({ slug: "test-post" }),
    })
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({ error: "Unauthorized" })
    expect(getServerSession).toHaveBeenCalledOnce()
  })
})
