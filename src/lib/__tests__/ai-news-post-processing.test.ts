import { beforeEach, describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getPostForAiAction: vi.fn(),
  runPostAiAction: vi.fn(),
  postUpdate: vi.fn(),
  categoryFindMany: vi.fn(),
  tagFindMany: vi.fn(),
  revalidatePublicContent: vi.fn(),
  touchCoverAssetUsage: vi.fn(),
}))

vi.mock("@/lib/ai-post-actions", () => ({
  POST_AI_ACTIONS: {
    summary: "summary",
    seoDescription: "seo-description",
    title: "title",
    slug: "slug",
    tags: "tags",
    category: "category",
    coverImage: "cover-image",
  },
  getPostForAiAction: mocks.getPostForAiAction,
  runPostAiAction: mocks.runPostAiAction,
}))

vi.mock("@/lib/cache", () => ({
  revalidatePublicContent: mocks.revalidatePublicContent,
}))

vi.mock("@/lib/cover-assets", () => ({
  touchCoverAssetUsage: mocks.touchCoverAssetUsage,
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      update: mocks.postUpdate,
    },
    category: {
      findMany: mocks.categoryFindMany,
    },
    tag: {
      findMany: mocks.tagFindMany,
    },
  },
}))

type TestPost = {
  id: string
  title: string
  slug: string
  content: string
  excerpt: string | null
  seoDescription: string | null
  published: boolean
  coverImage: string | null
  category: { id: string; name: string; slug: string } | null
  tags: Array<{ id: string; name: string; slug: string }>
}

function makePost(overrides: Partial<TestPost> = {}): TestPost {
  return {
    id: "post-1",
    title: "2026-05-11 AI 日报",
    slug: "ai-daily-2026-05-11",
    content: "# 今日摘要\n\n内容",
    excerpt: "旧摘要",
    seoDescription: null,
    published: false,
    coverImage: null,
    category: null,
    tags: [],
    ...overrides,
  }
}

function installPostUpdateMock(getCurrentPost: () => TestPost, setCurrentPost: (post: TestPost) => void) {
  mocks.postUpdate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => {
    const current = getCurrentPost()
    const next: TestPost = {
      ...current,
      excerpt: typeof data.excerpt === "string" ? data.excerpt : current.excerpt,
      seoDescription: typeof data.seoDescription === "string" ? data.seoDescription : current.seoDescription,
      coverImage: typeof data.coverImage === "string" ? data.coverImage : current.coverImage,
      category: typeof data.categoryId === "string"
        ? { id: data.categoryId, name: "工程实践", slug: "engineering" }
        : current.category,
      tags: data.tags && typeof data.tags === "object" && "set" in data.tags
        ? ((data.tags as { set: Array<{ id: string }> }).set.map((tag) => ({
            id: tag.id,
            name: tag.id === "tag-api" ? "API 设计" : "工程化",
            slug: tag.id === "tag-api" ? "api-design" : "engineering",
          })))
        : current.tags,
    }
    setCurrentPost(next)
    return next
  })
}

describe("ai news post processing", () => {
  let currentPost: TestPost

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    currentPost = makePost()
    mocks.getPostForAiAction.mockImplementation(async () => currentPost)
    installPostUpdateMock(() => currentPost, (post) => {
      currentPost = post
    })
    mocks.runPostAiAction.mockImplementation(async ({ action }: { action: string }) => {
      if (action === "summary") return { action, modelId: "model-summary", output: { summary: "生成后的摘要" } }
      if (action === "seo-description") return { action, modelId: "model-seo", output: { seoDescription: "生成后的 SEO 描述" } }
      if (action === "category") return { action, modelId: "model-taxonomy", output: { categoryId: "cat-ai" } }
      if (action === "tags") return { action, modelId: "model-taxonomy", output: { existingTagIds: ["tag-eng", "tag-api"] } }
      if (action === "cover-image") {
        return {
          action,
          modelId: "model-cover",
          output: { coverImage: "https://cdn.example.com/cover.png", coverAssetId: "asset-1" },
        }
      }
      throw new Error(`Unexpected action ${action}`)
    })
  })

  test("runs and applies the supported AI post actions for a fresh daily article", async () => {
    const { applyAiNewsPostEnhancements } = await import("@/lib/ai-news-post-processing")

    const result = await applyAiNewsPostEnhancements({ postId: "post-1", modelId: "model-1" })

    expect(mocks.runPostAiAction.mock.calls.map((call) => call[0].action)).toEqual([
      "summary",
      "seo-description",
      "category",
      "tags",
      "cover-image",
    ])
    expect(mocks.postUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ excerpt: "生成后的摘要", summaryModelId: "model-summary" }),
    }))
    expect(mocks.postUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ seoDescription: "生成后的 SEO 描述", seoModelId: "model-seo" }),
    }))
    expect(mocks.postUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ categoryId: "cat-ai" }),
    }))
    expect(mocks.postUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tags: { set: [{ id: "tag-eng" }, { id: "tag-api" }] } }),
    }))
    expect(mocks.postUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ coverImage: "https://cdn.example.com/cover.png", coverAssetId: "asset-1" }),
    }))
    expect(mocks.touchCoverAssetUsage).toHaveBeenCalledWith("asset-1")
    expect(mocks.revalidatePublicContent).not.toHaveBeenCalled()
    expect(result.failed).toEqual([])
    expect(result.applied).toEqual([
      { action: "summary", source: "ai" },
      { action: "seo-description", source: "ai" },
      { action: "category", source: "ai" },
      { action: "tags", source: "ai" },
      { action: "cover-image", source: "ai" },
    ])
    expect(result.post?.coverImage).toBe("https://cdn.example.com/cover.png")
  })

  test("falls back to default taxonomy when AI taxonomy output is unusable", async () => {
    mocks.runPostAiAction.mockImplementation(async ({ action }: { action: string }) => {
      if (action === "summary") return { action, modelId: "model-summary", output: { summary: "生成后的摘要" } }
      if (action === "seo-description") return { action, modelId: "model-seo", output: { seoDescription: "生成后的 SEO 描述" } }
      if (action === "category") return { action, modelId: "model-taxonomy", output: { categoryId: null } }
      if (action === "tags") throw new Error("AI tag output did not match existing tags")
      if (action === "cover-image") return { action, modelId: "model-cover", output: { coverImage: "https://cdn.example.com/cover.png", coverAssetId: "asset-1" } }
      throw new Error(`Unexpected action ${action}`)
    })
    mocks.categoryFindMany.mockResolvedValueOnce([{ id: "cat-eng", slug: "engineering" }])
    mocks.tagFindMany.mockResolvedValueOnce([{ id: "tag-eng", slug: "engineering" }])

    const { applyAiNewsPostEnhancements } = await import("@/lib/ai-news-post-processing")
    const result = await applyAiNewsPostEnhancements({ postId: "post-1" })

    expect(mocks.postUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ categoryId: "cat-eng" }),
    }))
    expect(mocks.postUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tags: { set: [{ id: "tag-eng" }] } }),
    }))
    expect(result.applied).toEqual(expect.arrayContaining([
      { action: "category", source: "fallback" },
      { action: "tags", source: "fallback" },
    ]))
    expect(result.failed).toEqual([
      { action: "tags", message: "AI tag output did not match existing tags" },
    ])
  })

  test("keeps existing taxonomy and cover while refreshing summary and SEO", async () => {
    currentPost = makePost({
      category: { id: "cat-existing", name: "工程实践", slug: "engineering" },
      tags: [{ id: "tag-existing", name: "工程化", slug: "engineering" }],
      coverImage: "https://cdn.example.com/existing.png",
    })
    const { applyAiNewsPostEnhancements } = await import("@/lib/ai-news-post-processing")

    const result = await applyAiNewsPostEnhancements({ postId: "post-1" })

    expect(mocks.runPostAiAction.mock.calls.map((call) => call[0].action)).toEqual(["summary", "seo-description"])
    expect(result.skipped).toEqual(["category", "tags", "cover-image"])
  })

  test("formats post-processing failures for the daily review summary", async () => {
    const { formatAiNewsPostEnhancementWarning } = await import("@/lib/ai-news-post-processing")

    expect(formatAiNewsPostEnhancementWarning({
      post: null,
      applied: [],
      skipped: [],
      failed: [{ action: "cover-image", message: "No available cover image model is configured" }],
    })).toBe("AI 辅助处理失败：封面：No available cover image model is configured")
  })
})
