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
const transaction = vi.fn(async (operations: unknown[]) => operations)
const revalidatePublicContent = vi.fn()

vi.mock("@/lib/cache", () => ({
  revalidatePublicContent,
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    comment: {
      count,
      findMany,
      updateMany,
      delete: deleteComment,
    },
    $transaction: transaction,
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

  test("revalidates affected public post pages after moderation changes", async () => {
    const { getServerSession } = await import("next-auth")
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } } as never)
    findMany.mockResolvedValueOnce([
      { post: { slug: "post-a" } },
      { post: { slug: "post-a" } },
      { post: { slug: "post-b" } },
    ])
    updateMany.mockResolvedValueOnce({ count: 3 })

    const { PATCH } = await import("../route")
    const response = await PATCH(
      new Request("http://localhost/api/admin/comments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: ["c1", "c2", "c3"], status: "APPROVED" }),
      }),
    )

    expect(response.status).toBe(200)
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["c1", "c2", "c3"] }, deletedAt: null },
      data: { status: "APPROVED" },
    })
    expect(revalidatePublicContent).toHaveBeenCalledWith({ slug: "post-a" })
    expect(revalidatePublicContent).toHaveBeenCalledWith({ slug: "post-b" })
    expect(revalidatePublicContent).toHaveBeenCalledTimes(2)
  })

  test("revalidates affected public post pages after hiding comments", async () => {
    const { getServerSession } = await import("next-auth")
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: "admin-1", role: "ADMIN" } } as never)
    findMany.mockResolvedValueOnce([
      { id: "c1", post: { slug: "post-a" } },
      { id: "c2", post: { slug: "post-b" } },
    ])
    updateMany.mockResolvedValueOnce({ count: 2 })

    const { DELETE } = await import("../route")
    const response = await DELETE(new Request("http://localhost/api/admin/comments?id=c1&id=c2"))

    expect(response.status).toBe(200)
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        OR: [{ id: { in: ["c1", "c2"] } }, { parentId: { in: ["c1", "c2"] } }],
      }),
    }))
    expect(transaction).toHaveBeenCalledOnce()
    expect(revalidatePublicContent).toHaveBeenCalledWith({ slug: "post-a" })
    expect(revalidatePublicContent).toHaveBeenCalledWith({ slug: "post-b" })
  })
})
