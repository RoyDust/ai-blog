import { afterAll, beforeEach, describe, expect, test, vi } from "vitest"

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

const findMany = vi.fn()
const updateMany = vi.fn()
const deleteComment = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    comment: {
      findMany,
      updateMany,
      delete: deleteComment,
    },
  },
}))

describe("GET /api/admin/comments", () => {
  const originalNodeEnv = process.env.NODE_ENV

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NODE_ENV = "test"
  })

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv
  })

  test("returns json 500 when prisma query fails", async () => {
    const { getServerSession } = await import("next-auth")
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } } as never)
    findMany.mockRejectedValueOnce(new Error("db exploded"))

    const { GET } = await import("../route")
    const response = await GET(new Request('http://localhost/api/admin/comments'))
    const payload = await response.json()

    expect(response.status).toBe(500)
    expect(payload).toMatchObject({ error: "Failed to load comments", detail: "db exploded" })
  })
})
