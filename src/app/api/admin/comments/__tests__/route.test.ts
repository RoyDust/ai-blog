import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest"

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

const findMany = vi.fn()
const count = vi.fn()
const updateMany = vi.fn()
const deleteComment = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    comment: {
      count,
      findMany,
      updateMany,
      delete: deleteComment,
    },
  },
}))

describe("GET /api/admin/comments", () => {
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("NODE_ENV", "test")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  afterAll(() => {
    consoleErrorSpy.mockRestore()
  })

  test("returns json 500 when prisma query fails", async () => {
    const { getServerSession } = await import("next-auth")
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } } as never)
    findMany.mockRejectedValueOnce(new Error("db exploded"))

    const { GET } = await import("../route")
    const response = await GET(new Request('http://localhost/api/admin/comments'))
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload).toEqual({ error: "Failed to load comments" })
  })

  test("returns a requested comments page with real status totals", async () => {
    const { getServerSession } = await import("next-auth")
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } } as never)
    count
      .mockResolvedValueOnce(125)
      .mockResolvedValueOnce(125)
      .mockResolvedValueOnce(35)
      .mockResolvedValueOnce(80)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(2)
    findMany.mockResolvedValueOnce([{ id: "comment-101", content: "later pending", status: "PENDING" }])

    const { GET } = await import("../route")
    const response = await GET(new Request("http://localhost/api/admin/comments?page=6&limit=20&status=PENDING&q=later"))
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 100,
      take: 20,
      where: expect.objectContaining({
        status: "PENDING",
        OR: expect.any(Array),
      }),
    }))
    expect(payload.pagination).toEqual({ page: 6, limit: 20, total: 125, totalPages: 7 })
    expect(payload.stats).toEqual({ total: 125, pending: 35, approved: 80, rejected: 8, spam: 2 })
  })
})
