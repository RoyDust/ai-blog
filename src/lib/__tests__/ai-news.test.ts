import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

const createAdminPost = vi.fn()
const updateAdminPost = vi.fn()
const generatePostReview = vi.fn()
const isAutoPublishableReview = vi.fn()
const publishAiDraftPost = vi.fn()
const findFirst = vi.fn()
const createAiNewsRun = vi.fn()
const updateAiNewsRun = vi.fn()

vi.mock("@/lib/ai-authoring", () => ({
  createAdminPost,
  updateAdminPost,
  publishAiDraftPost,
}))

vi.mock("@/lib/ai-review", () => ({
  generatePostReview,
  isAutoPublishableReview,
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findFirst,
    },
    aiNewsRun: {
      create: createAiNewsRun,
      update: updateAiNewsRun,
    },
  },
}))

describe("ai news aggregation", () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    createAiNewsRun.mockResolvedValue({ id: "run-1", startedAt: new Date("2026-04-29T08:00:00Z") })
    process.env = {
      ...originalEnv,
      DASHSCOPE_API_KEY: "test-key",
      DASHSCOPE_MODEL: "qwen3.5-flash",
    }
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.unstubAllGlobals()
  })

  test("parses rss and atom items then deduplicates by canonical url", async () => {
    const { parseNewsFeed, dedupeNewsItems } = await import("@/lib/ai-news")
    const rss = `<?xml version="1.0"?><rss><channel><item><title>OpenAI 发布新模型</title><link>https://example.com/a?utm_source=x</link><description>模型能力更新</description><pubDate>Wed, 29 Apr 2026 02:00:00 GMT</pubDate></item></channel></rss>`
    const atom = `<?xml version="1.0"?><feed><entry><title>OpenAI 发布新模型</title><link href="https://example.com/a"/><summary>同一事件</summary><updated>2026-04-29T03:00:00Z</updated></entry></feed>`

    const items = [
      ...parseNewsFeed(rss, { sourceId: "rss", sourceName: "RSS" }),
      ...parseNewsFeed(atom, { sourceId: "atom", sourceName: "Atom" }),
    ]

    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ title: "OpenAI 发布新模型", url: "https://example.com/a?utm_source=x", sourceName: "RSS" })
    expect(dedupeNewsItems(items)).toHaveLength(1)
  })

  test("generates a normalized daily AI news draft from DashScope JSON", async () => {
    const upstreamFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "```json\n{\"title\":\"2026-04-29 AI 日报：模型与产品更新\",\"excerpt\":\"今日 AI 重点新闻摘要。\",\"content\":\"# 今日摘要\\n\\n- OpenAI 更新。\\n\\n## 来源链接\"}\n```",
            },
          },
        ],
      }),
    })
    vi.stubGlobal("fetch", upstreamFetch)

    const { generateDailyAiNewsDraft } = await import("@/lib/ai-news")
    const draft = await generateDailyAiNewsDraft({
      date: new Date("2026-04-29T08:00:00Z"),
      candidates: [
        {
          id: "item-1",
          title: "OpenAI 更新",
          url: "https://example.com/openai",
          summary: "新模型发布",
          sourceId: "openai",
          sourceName: "OpenAI Blog",
          publishedAt: new Date("2026-04-29T02:00:00Z"),
        },
      ],
    })

    expect(upstreamFetch).toHaveBeenCalledWith(
      expect.stringContaining("/chat/completions"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
      }),
    )
    expect(JSON.parse(String(upstreamFetch.mock.calls[0]?.[1]?.body))).toMatchObject({ model: "qwen3.5-flash" })
    expect(draft).toMatchObject({
      title: "2026-04-29 AI 日报：模型与产品更新",
      slug: "ai-daily-2026-04-29",
      excerpt: "今日 AI 重点新闻摘要。",
      generatedBy: { id: "post-summary-openai-compatible", name: "文章摘要生成", model: "qwen3.5-flash" },
    })
    expect(draft.content).toContain("https://example.com/openai")
    expect(draft.content.match(/^## 来源链接/gm)).toHaveLength(1)
    expect(draft.content).toContain("生成标注：本文由 AI 模型")
    expect(draft.content).toContain("qwen3\\.5\\-flash")
  })

  test("creates a draft and auto-publishes when AI review passes", async () => {
    const rssFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `<?xml version="1.0"?><rss><channel><item><title>Anthropic 发布研究</title><link>https://example.com/anthropic</link><description>研究摘要</description><pubDate>Wed, 29 Apr 2026 02:00:00 GMT</pubDate></item></channel></rss>`,
    })
    const completionFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ title: "2026-04-29 AI 日报", excerpt: "摘要", content: "# 今日摘要\n\n内容" }) } }],
      }),
    })
    const fetchImpl = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      if (init?.method === "POST") return completionFetch(input, init)
      return rssFetch(input, init)
    }) as typeof fetch
    findFirst.mockResolvedValueOnce(null)
    createAdminPost.mockResolvedValueOnce({ id: "post-1", title: "2026-04-29 AI 日报", slug: "ai-daily-2026-04-29", published: false })
    generatePostReview.mockResolvedValueOnce({ verdict: "ready", score: 92, summary: "可以发布", checks: [], suggestions: [] })
    isAutoPublishableReview.mockReturnValueOnce(true)
    publishAiDraftPost.mockResolvedValueOnce({ id: "post-1", published: true })

    const { runDailyAiNews } = await import("@/lib/ai-news")
    const result = await runDailyAiNews({
      authorId: "admin-1",
      date: new Date("2026-04-29T08:00:00Z"),
      sources: [{ id: "anthropic", name: "Anthropic", feedUrl: "https://example.com/feed.xml" }],
      fetchImpl,
    })

    expect(createAdminPost).toHaveBeenCalledWith({
      authorId: "admin-1",
      input: expect.objectContaining({
        slug: "ai-daily-2026-04-29",
        published: false,
        content: expect.stringContaining("生成标注：本文由 AI 模型"),
      }),
    })
    expect(generatePostReview).toHaveBeenCalledWith(expect.objectContaining({ slug: "ai-daily-2026-04-29" }))
    expect(publishAiDraftPost).toHaveBeenCalledWith({ postId: "post-1" })
    expect(createAiNewsRun).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "RUNNING",
        trigger: "MANUAL",
        runDate: new Date("2026-04-29T08:00:00Z"),
      }),
    })
    expect(updateAiNewsRun).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: expect.objectContaining({ status: "SUCCEEDED", sourceCount: 1, failureCount: 0, postId: "post-1", published: true, reviewScore: 92 }),
    })
    expect(result).toMatchObject({
      operation: "created",
      published: true,
      post: { id: "post-1" },
      generatedBy: { id: "post-summary-openai-compatible", model: "qwen3.5-flash" },
      run: { id: "run-1", status: "SUCCEEDED" },
    })
  })

  test("skips generation when the daily slug already exists", async () => {
    findFirst.mockResolvedValueOnce({ id: "post-existing", title: "已存在", slug: "ai-daily-2026-04-29", published: true })

    const { runDailyAiNews } = await import("@/lib/ai-news")
    const result = await runDailyAiNews({
      authorId: "admin-1",
      date: new Date("2026-04-29T08:00:00Z"),
      sources: [{ id: "source", name: "Source", feedUrl: "https://example.com/feed.xml" }],
      fetchImpl: vi.fn() as unknown as typeof fetch,
    })

    expect(createAdminPost).not.toHaveBeenCalled()
    expect(updateAdminPost).not.toHaveBeenCalled()
    expect(updateAiNewsRun).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: expect.objectContaining({ status: "SKIPPED", postId: "post-existing", published: true }),
    })
    expect(result).toMatchObject({
      operation: "skipped",
      reason: "Daily AI news already exists",
      run: { id: "run-1", status: "SKIPPED" },
    })
  })

  test("regenerates an existing daily AI news post when requested", async () => {
    const rssFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `<?xml version="1.0"?><rss><channel><item><title>OpenAI 发布新能力</title><link>https://example.com/openai-new</link><description>能力摘要</description><pubDate>Wed, 29 Apr 2026 02:00:00 GMT</pubDate></item></channel></rss>`,
    })
    const completionFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify({ title: "2026-04-29 AI 日报：重新生成", excerpt: "新的摘要", content: "# 今日摘要\n\n新内容" }) } }],
      }),
    })
    const fetchImpl = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      if (init?.method === "POST") return completionFetch(input, init)
      return rssFetch(input, init)
    }) as typeof fetch
    findFirst.mockResolvedValueOnce({ id: "post-existing", title: "旧日报", slug: "ai-daily-2026-04-29", published: true })
    updateAdminPost.mockResolvedValueOnce({ id: "post-existing", slug: "ai-daily-2026-04-29", published: true })
    generatePostReview.mockResolvedValueOnce({ verdict: "ready", score: 93, summary: "可以发布", checks: [], suggestions: [] })
    isAutoPublishableReview.mockReturnValueOnce(true)

    const { runDailyAiNews } = await import("@/lib/ai-news")
    const result = await runDailyAiNews({
      authorId: "admin-1",
      date: new Date("2026-04-29T08:00:00Z"),
      regenerate: true,
      sources: [{ id: "openai", name: "OpenAI", feedUrl: "https://example.com/feed.xml" }],
      fetchImpl,
    })

    expect(createAdminPost).not.toHaveBeenCalled()
    expect(updateAdminPost).toHaveBeenCalledWith({
      id: "post-existing",
      input: expect.objectContaining({
        title: "2026-04-29 AI 日报：重新生成",
        slug: "ai-daily-2026-04-29",
        content: expect.stringContaining("生成标注：本文由 AI 模型"),
        excerpt: "新的摘要",
        published: true,
      }),
    })
    expect(publishAiDraftPost).not.toHaveBeenCalled()
    expect(updateAiNewsRun).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: expect.objectContaining({ status: "SUCCEEDED", postId: "post-existing", postTitle: "2026-04-29 AI 日报：重新生成", published: true }),
    })
    expect(result).toMatchObject({
      operation: "regenerated",
      published: true,
      post: { id: "post-existing", slug: "ai-daily-2026-04-29", published: true },
    })
  })

  test("records failed daily AI news runs before rethrowing", async () => {
    findFirst.mockResolvedValueOnce(null)

    const { runDailyAiNews } = await import("@/lib/ai-news")

    await expect(
      runDailyAiNews({
        authorId: "admin-1",
        date: new Date("2026-04-29T08:00:00Z"),
        sources: [{ id: "broken", name: "Broken", feedUrl: "https://example.com/feed.xml" }],
        fetchImpl: vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch,
      }),
    ).rejects.toThrow("No AI news candidates available")

    expect(updateAiNewsRun).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: expect.objectContaining({ status: "FAILED", sourceCount: 0, failureCount: 1, error: "No AI news candidates available" }),
    })
  })
})
