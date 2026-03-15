import { beforeEach, describe, expect, test, vi } from "vitest"

const createPost = vi.fn()
const getServerSession = vi.fn()
const revalidatePublicContent = vi.fn()

vi.mock("next-auth", () => ({
  getServerSession,
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@/lib/cache", () => ({
  revalidatePublicContent,
}))

vi.mock("@/lib/posts", () => ({
  getPublishedPostsPage: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      create: createPost,
    },
  },
}))

describe("POST /api/posts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test("forces non-admin post creation to stay unpublished", async () => {
    getServerSession.mockResolvedValueOnce({ user: { id: "user-1", role: "USER" } })
    createPost.mockResolvedValueOnce({
      id: "post-1",
      slug: "draft-post",
      published: false,
      category: null,
      tags: [],
    })

    const { POST } = await import("../route")
    const response = await POST(
      new Request("http://localhost/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Draft Post",
          slug: "draft-post",
          content: "content",
          published: true,
        }),
      }),
    )

    expect(response.status).toBe(200)
    expect(createPost).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          authorId: "user-1",
          published: false,
          publishedAt: null,
        }),
      }),
    )
    expect(revalidatePublicContent).not.toHaveBeenCalled()
  })
})
