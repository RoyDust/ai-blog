import { beforeEach, describe, expect, test, vi } from "vitest"

const getPublishedPostsPage = vi.fn()

vi.mock("@/lib/api-operation-log-route", () => ({
  withApiOperationLogging: (handler: unknown) => handler,
}))

vi.mock("@/lib/posts", () => ({
  getPublishedPostsPage,
}))

describe("/api/posts route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("only exposes public GET and removes legacy POST write surface", async () => {
    const routeModule = await import("../route")

    expect(typeof routeModule.GET).toBe("function")
    expect("POST" in routeModule).toBe(false)
    expect("PATCH" in routeModule).toBe(false)
    expect("PUT" in routeModule).toBe(false)
    expect("DELETE" in routeModule).toBe(false)
  })

  test("returns paginated public posts with clamped query parameters", async () => {
    getPublishedPostsPage.mockResolvedValueOnce({
      posts: [{ id: "post-1", slug: "hello", title: "Hello" }],
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
    })

    const { GET } = await import("../route")
    const response = await GET(
      new Request("http://localhost/api/posts?page=0&limit=999&category=ai&tag=nextjs&search=agent"),
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(getPublishedPostsPage).toHaveBeenCalledWith({
      page: 1,
      limit: 50,
      category: "ai",
      tag: "nextjs",
      search: "agent",
    })
    expect(payload).toEqual({
      success: true,
      data: [{ id: "post-1", slug: "hello", title: "Hello" }],
      pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
    })
  })
})
