import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

const transaction = vi.fn()
const findMany = vi.fn()
const updateMany = vi.fn()
const findUnique = vi.fn()
const revalidatePublicContent = vi.fn()
const resolvePostCoverInput = vi.fn()
const touchCoverAssetUsage = vi.fn()

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: transaction,
  },
}))

vi.mock("@/lib/cache", () => ({
  revalidatePublicContent,
}))

vi.mock("@/lib/cover-assets", () => ({
  resolvePostCoverInput,
  touchCoverAssetUsage,
}))

function authedRequest() {
  return new Request("http://localhost/api/cron/publish-scheduled", {
    method: "POST",
    headers: { Authorization: "Bearer cron-secret" },
  })
}

describe("POST /api/cron/publish-scheduled", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.useRealTimers()
    process.env = { ...originalEnv, CRON_SECRET: "cron-secret" }
    transaction.mockImplementation((callback) => callback({ post: { findMany, updateMany, findUnique } }))
    resolvePostCoverInput.mockResolvedValue({
      coverImage: undefined,
      coverAssetId: undefined,
      selectedAssetId: null,
    })
    touchCoverAssetUsage.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
    process.env = { ...originalEnv }
  })

  test("rejects requests without the cron bearer secret", async () => {
    const { POST } = await import("../route")
    const response = await POST(new Request("http://localhost/api/cron/publish-scheduled", { method: "POST" }))
    const payload = await response.json()

    expect(response.status).toBe(401)
    expect(payload).toEqual({ error: "Unauthorized" })
    expect(transaction).not.toHaveBeenCalled()
  })

  test("returns an empty summary when no posts are due", async () => {
    findMany.mockResolvedValueOnce([])

    const { POST } = await import("../route")
    const response = await POST(authedRequest())
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({ success: true, data: { publishedCount: 0, posts: [] } })
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        deletedAt: null,
        published: false,
        scheduledAt: { lte: expect.any(Date) },
      }),
    }))
    expect(updateMany).not.toHaveBeenCalled()
    expect(revalidatePublicContent).not.toHaveBeenCalled()
  })

  test("publishes due posts with missing-cover backfill and revalidates public cache", async () => {
    const publishedAt = new Date("2026-05-17T01:00:00.000Z")
    vi.useFakeTimers()
    vi.setSystemTime(publishedAt)

    findMany.mockResolvedValueOnce([
      {
        id: "post-1",
        slug: "scheduled-post",
        coverImage: null,
        coverAssetId: null,
        category: { slug: "engineering" },
        series: { slug: "nextjs-series" },
        tags: [{ slug: "nextjs" }],
      },
    ])
    resolvePostCoverInput.mockResolvedValueOnce({
      coverImage: "https://cdn.example.com/cover.jpg",
      coverAssetId: "cover-1",
      selectedAssetId: "cover-1",
    })
    updateMany.mockResolvedValueOnce({ count: 1 })
    findUnique.mockResolvedValueOnce({
      id: "post-1",
      slug: "scheduled-post",
      published: true,
      publishedAt,
      scheduledAt: null,
      category: { slug: "engineering" },
      series: { slug: "nextjs-series" },
      tags: [{ slug: "nextjs" }],
    })

    const { POST } = await import("../route")
    const response = await POST(authedRequest())
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(resolvePostCoverInput).toHaveBeenCalledWith({ allowRandom: true })
    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: "post-1",
        deletedAt: null,
        published: false,
        scheduledAt: { lte: publishedAt },
      },
      data: {
        published: true,
        publishedAt,
        scheduledAt: null,
        coverImage: "https://cdn.example.com/cover.jpg",
        coverAssetId: "cover-1",
      },
    })
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: "post-1" },
      select: expect.any(Object),
    })
    expect(touchCoverAssetUsage).toHaveBeenCalledWith("cover-1")
    expect(revalidatePublicContent).toHaveBeenCalledWith({
      slug: "scheduled-post",
      categorySlug: "engineering",
      seriesSlug: "nextjs-series",
      tagSlugs: ["nextjs"],
    })
    expect(payload).toEqual({
      success: true,
      data: {
        publishedCount: 1,
        posts: [{ id: "post-1", slug: "scheduled-post", publishedAt: publishedAt.toISOString() }],
      },
    })
  })

  test("skips rows claimed by an overlapping cron run", async () => {
    findMany.mockResolvedValueOnce([
      {
        id: "post-1",
        slug: "scheduled-post",
        coverImage: "https://cdn.example.com/existing.jpg",
        coverAssetId: null,
        category: null,
        series: null,
        tags: [],
      },
    ])
    updateMany.mockResolvedValueOnce({ count: 0 })

    const { POST } = await import("../route")
    const response = await POST(authedRequest())
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(findUnique).not.toHaveBeenCalled()
    expect(touchCoverAssetUsage).not.toHaveBeenCalled()
    expect(revalidatePublicContent).not.toHaveBeenCalled()
    expect(payload).toEqual({ success: true, data: { publishedCount: 0, posts: [] } })
  })
})
