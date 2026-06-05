import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"

const createAdminPost = vi.fn()
const updateAdminPost = vi.fn()
const generatePostReview = vi.fn()
const isAutoPublishableReview = vi.fn()
const publishAiDraftPost = vi.fn()
const applyAiNewsPostEnhancements = vi.fn()
const formatAiNewsPostEnhancementWarning = vi.fn()
const findFirst = vi.fn()
const updateManyPost = vi.fn()
const createAiNewsRun = vi.fn()
const updateAiNewsRun = vi.fn()
const findManyAiNewsSource = vi.fn()

vi.mock("@/lib/ai-authoring", () => ({
  createAdminPost,
  updateAdminPost,
  publishAiDraftPost,
}))

vi.mock("@/lib/ai-review", () => ({
  generatePostReview,
  isAutoPublishableReview,
}))

vi.mock("@/lib/ai-news-post-processing", () => ({
  applyAiNewsPostEnhancements,
  formatAiNewsPostEnhancementWarning,
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findFirst,
      updateMany: updateManyPost,
    },
    aiNewsRun: {
      create: createAiNewsRun,
      update: updateAiNewsRun,
    },
    aiNewsSource: {
      findMany: findManyAiNewsSource,
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
    delete process.env.GITHUB_TOKEN
    applyAiNewsPostEnhancements.mockResolvedValue({ post: null, applied: [], skipped: [], failed: [] })
    formatAiNewsPostEnhancementWarning.mockImplementation((result: { failed?: unknown[] }) =>
      result.failed?.length ? "AI 辅助处理失败：mock" : null,
    )
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
    expect(JSON.parse(String(upstreamFetch.mock.calls[0]?.[1]?.body))).toMatchObject({ model: "qwen3.5-flash", max_tokens: 6000 })
    expect(draft).toMatchObject({
      title: "2026-04-29 AI 日报：模型与产品更新",
      slug: "ai-daily-2026-04-29",
      excerpt: "今日 AI 重点新闻摘要。",
      generatedBy: { id: "post-summary-openai-compatible", name: "文章摘要生成", model: "qwen3.5-flash" },
    })
    expect(draft.content).toContain("https://example.com/openai")
    expect(draft.content.match(/^## 来源链接/gm)).toHaveLength(1)
    expect(draft.content).toContain("生成标注：本文由 AI 模型")
    expect(draft.content).toContain("qwen3.5-flash")
  })

  test("generates markdown content from structured daily AI news draft JSON", async () => {
    const upstreamFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: "2026-04-29 AI 日报：实时语音与开发者工具",
                excerpt: "今日 AI 新闻聚焦实时语音模型、开发者工具更新和产品化趋势。",
                intro: "实时语音和开发者工具成为今天的两条主线。模型能力继续向更低延迟和更易集成的方向演进。",
                items: [
                  {
                    title: "OpenAI 发布实时语音模型",
                    description: "OpenAI 推出面向实时对话和转录场景的新模型。",
                    keyPoints: ["支持低延迟语音交互。", "适合客服、会议和翻译场景。"],
                    sourceName: "OpenAI Blog",
                    url: "https://example.com/openai",
                  },
                ],
                trends: [
                  { title: "语音交互加速落地", desc: "实时语音能力正在从演示能力进入应用基础设施。" },
                ],
              }),
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
          title: "OpenAI 发布实时语音模型",
          url: "https://example.com/openai",
          summary: "新实时语音模型发布",
          sourceId: "openai",
          sourceName: "OpenAI Blog",
          publishedAt: new Date("2026-04-29T02:00:00Z"),
        },
      ],
    })

    const requestBody = JSON.parse(String(upstreamFetch.mock.calls[0]?.[1]?.body))
    expect(String(requestBody.messages[1].content)).toContain("items 是数组")
    expect(draft.content).toContain("## 今日摘要")
    expect(draft.content).toContain("## 今日重点")
    expect(draft.content).toContain("### 1、OpenAI 发布实时语音模型")
    expect(draft.content).toContain("🔊 支持低延迟语音交互。")
    expect(draft.content).toContain("## 今日趋势总结")
    expect(draft.content).toContain("语音交互加速落地")
    expect(draft.content).toContain("> 来源：[OpenAI Blog](https://example.com/openai)")
    expect(draft.content.match(/^## 来源链接/gm)).toHaveLength(1)
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
    applyAiNewsPostEnhancements.mockResolvedValueOnce({
      post: {
        id: "post-1",
        title: "2026-04-29 AI 日报",
        slug: "ai-daily-2026-04-29",
        content: "# 今日摘要\n\n内容",
        excerpt: "AI 摘要",
        seoDescription: "SEO 描述",
        published: false,
        coverImage: "https://cdn.example.com/ai-daily-cover.png",
        category: { id: "cat-engineering", name: "工程实践", slug: "engineering" },
        tags: [{ id: "tag-engineering", name: "工程化", slug: "engineering" }],
      },
      applied: [
        { action: "summary", source: "ai" },
        { action: "seo-description", source: "ai" },
        { action: "category", source: "ai" },
        { action: "tags", source: "ai" },
        { action: "cover-image", source: "ai" },
      ],
      skipped: [],
      failed: [],
    })
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
        generatedByAiNews: true,
        content: expect.stringContaining("生成标注：本文由 AI 模型"),
      }),
    })
    expect(applyAiNewsPostEnhancements).toHaveBeenCalledWith({ postId: "post-1", modelId: undefined })
    expect(generatePostReview).toHaveBeenCalledWith(expect.objectContaining({
      slug: "ai-daily-2026-04-29",
      coverImage: "https://cdn.example.com/ai-daily-cover.png",
    }))
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

  test("creates a draft from RSS, Hacker News, and GitHub Releases while recording selection metrics and enforcing publish gates", async () => {
    const chatUrl = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
    const sourceRows = [
      {
        id: "rss",
        type: "RSS",
        name: "RSS Source",
        url: "https://feeds.example.com/ai.xml",
        enabled: true,
        weight: 5,
        fetchLimit: null,
        minScore: null,
        config: null,
      },
      {
        id: "hn",
        type: "HACKERNEWS",
        name: "Hacker News",
        url: "https://news.ycombinator.com/",
        enabled: true,
        weight: 4,
        fetchLimit: 1,
        minScore: 0,
        config: { apiBase: "https://hn.test/v0", commentLimit: 1 },
      },
      {
        id: "gh",
        type: "GITHUB_RELEASES",
        name: "GitHub Releases",
        url: "https://github.com/vercel/ai",
        enabled: true,
        weight: 3,
        fetchLimit: 1,
        minScore: null,
        config: { owner: "vercel", repo: "ai" },
      },
      {
        id: "broken",
        type: "RSS",
        name: "Broken RSS",
        url: "https://feeds.example.com/broken.xml",
        enabled: true,
        weight: 2,
        fetchLimit: null,
        minScore: null,
        config: null,
      },
    ]
    const scoreByTitle = new Map([
      ["OpenAI 发布企业级代理", { score: 9, reason: "major product update", summary: "OpenAI 发布企业代理能力。", tags: ["agent"], riskFlags: [] }],
      ["NotebookLM adds developer APIs", { score: 3, reason: "low daily relevance", summary: "NotebookLM 小更新。", tags: ["product"], riskFlags: ["low-signal"] }],
      ["Useful AI coding agent", { score: 8, reason: "developer relevance", summary: "开发者正在讨论 AI 编码代理。", tags: ["developer"], riskFlags: [] }],
      ["vercel/ai v6.0.0", { score: 7.5, reason: "open source release", summary: "Vercel AI SDK 发布新版本。", tags: ["open-source"], riskFlags: [] }],
    ])

    findManyAiNewsSource.mockResolvedValueOnce(sourceRows)
    findFirst.mockResolvedValueOnce(null)
    updateManyPost.mockResolvedValue({ count: 1 })
    createAdminPost.mockResolvedValueOnce({ id: "post-1", title: "2026-04-29 AI 日报：代理与开源更新", slug: "ai-daily-2026-04-29", published: false })
    generatePostReview.mockResolvedValueOnce({ verdict: "ready", score: 94, summary: "可以发布", checks: [], suggestions: [] })
    isAutoPublishableReview.mockReturnValueOnce(true)
    publishAiDraftPost.mockResolvedValueOnce({ id: "post-1", published: true })

    const textResponse = (text: string, init: { ok?: boolean; status?: number } = {}) => ({
      ok: init.ok ?? true,
      status: init.status ?? 200,
      text: async () => text,
    })
    const jsonResponse = (json: unknown, init: { ok?: boolean; status?: number } = {}) => ({
      ok: init.ok ?? true,
      status: init.status ?? 200,
      json: async () => json,
    })
    const chatResponse = (content: unknown) =>
      jsonResponse({
        choices: [
          {
            message: {
              content: typeof content === "string" ? content : JSON.stringify(content),
            },
          },
        ],
      })

    const fetchImpl = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (url === "https://feeds.example.com/ai.xml") {
        return Promise.resolve(
          textResponse(
            `<?xml version="1.0"?><rss><channel>
              <item><title>OpenAI 发布企业级代理</title><link>https://example.com/openai-agent?utm_source=rss</link><description>面向企业的代理能力更新。</description><pubDate>Wed, 29 Apr 2026 02:00:00 GMT</pubDate></item>
              <item><title>NotebookLM adds developer APIs</title><link>https://example.com/notebooklm</link><description>较小的产品更新。</description><pubDate>Wed, 29 Apr 2026 01:00:00 GMT</pubDate></item>
            </channel></rss>`,
          ),
        )
      }
      if (url === "https://feeds.example.com/broken.xml") {
        return Promise.resolve(textResponse("feed unavailable", { ok: false, status: 503 }))
      }
      if (url === "https://hn.test/v0/topstories.json") {
        return Promise.resolve(jsonResponse([101]))
      }
      if (url === "https://hn.test/v0/item/101.json") {
        return Promise.resolve(
          jsonResponse({
            id: 101,
            type: "story",
            by: "alice",
            title: "Useful AI coding agent",
            url: "https://news.example.com/ai-agent",
            score: 180,
            descendants: 24,
            time: 1777449600,
            kids: [201],
          }),
        )
      }
      if (url === "https://hn.test/v0/item/201.json") {
        return Promise.resolve(jsonResponse({ id: 201, type: "comment", text: "<p>Strong developer signal.</p>" }))
      }
      if (url === "https://api.github.com/repos/vercel/ai/releases?per_page=1") {
        return Promise.resolve(
          jsonResponse([
            {
              id: 601,
              html_url: "https://github.com/vercel/ai/releases/tag/v6.0.0",
              tag_name: "v6.0.0",
              name: "v6.0.0",
              body: "New model routing and agent toolkit updates.",
              published_at: "2026-04-29T04:00:00Z",
              author: { login: "maintainer" },
            },
          ]),
        )
      }
      if (url === chatUrl && init?.method === "POST") {
        const body = JSON.parse(String(init.body))
        const userContent = String(body.messages?.find((message: { role?: string }) => message.role === "user")?.content ?? "")
        const scoredTitle = Array.from(scoreByTitle.keys()).find((title) => userContent.includes(`Title: ${title}`))
        if (scoredTitle) return Promise.resolve(chatResponse(scoreByTitle.get(scoredTitle)))

        return Promise.resolve(
          chatResponse({
            title: "2026-04-29 AI 日报：代理与开源更新",
            excerpt: "今日 AI 新闻聚焦企业级代理、开发者社区讨论和开源框架版本更新。",
            content: "# 今日摘要\n\n- OpenAI 发布企业级代理。\n- Hacker News 讨论 AI coding agent。\n- vercel/ai 发布 v6.0.0。\n\n## 来源链接",
          }),
        )
      }
      return Promise.reject(new Error(`Unexpected URL ${url}`))
    }) as unknown as typeof fetch

    const { runDailyAiNews } = await import("@/lib/ai-news")
    const result = await runDailyAiNews({
      authorId: "admin-1",
      date: new Date("2026-04-29T08:00:00Z"),
      fetchImpl,
    })

    expect(findManyAiNewsSource).toHaveBeenCalledWith({
      where: { enabled: true },
      orderBy: [{ weight: "desc" }, { name: "asc" }],
    })
    expect(fetchImpl).toHaveBeenCalledWith("https://feeds.example.com/broken.xml", expect.any(Object))
    expect(createAdminPost).toHaveBeenCalledWith({
      authorId: "admin-1",
      input: expect.objectContaining({
        title: "2026-04-29 AI 日报：代理与开源更新",
        slug: "ai-daily-2026-04-29",
        published: false,
        generatedByAiNews: true,
        content: expect.stringContaining("https://github.com/vercel/ai/releases/tag/v6.0.0"),
      }),
    })
    expect(publishAiDraftPost).not.toHaveBeenCalled()
    expect(updateAiNewsRun).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: expect.objectContaining({
        status: "SUCCEEDED",
        sourceCount: 4,
        failureCount: 1,
        rawCandidateCount: 4,
        dedupedCandidateCount: 4,
        scoredCandidateCount: 4,
        selectedCandidateCount: 3,
        sourceFailureJson: [
          expect.objectContaining({
            sourceId: "broken",
            sourceName: "Broken RSS",
            sourceType: "RSS",
            url: "https://feeds.example.com/broken.xml",
            stage: "fetch",
            message: expect.stringContaining("HTTP 503"),
          }),
        ],
        qualityScore: 82,
        citationCoverage: 1,
        generationMode: "candidate-pipeline",
        postId: "post-1",
        published: false,
        reviewScore: 94,
        reviewSummary: expect.stringContaining("入选候选少于 6 条"),
      }),
    })
    expect(updateManyPost).toHaveBeenCalledWith({
      where: { id: "post-1", generatedByAiNews: false },
      data: { generatedByAiNews: true },
    })
    expect(result).toMatchObject({
      operation: "created",
      published: false,
      sourceCount: 4,
      autoReview: {
        published: false,
        summary: expect.stringContaining("未自动发布"),
      },
      metrics: {
        rawCandidateCount: 4,
        dedupedCandidateCount: 4,
        scoredCandidateCount: 4,
        selectedCandidateCount: 3,
        sourceFailureJson: [expect.objectContaining({ sourceId: "broken", stage: "fetch" })],
        qualityScore: 82,
        citationCoverage: 1,
        generationMode: "candidate-pipeline",
        configuredSourceCount: 4,
      },
    })
  })

  test("skips generation when the daily slug already exists", async () => {
    findFirst.mockResolvedValueOnce({ id: "post-existing", title: "已存在", slug: "ai-daily-2026-04-29", published: true })
    updateManyPost.mockResolvedValue({ count: 1 })

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
    expect(updateManyPost).toHaveBeenCalledWith({
      where: { id: "post-existing", generatedByAiNews: false },
      data: { generatedByAiNews: true },
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
        generatedByAiNews: true,
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

  test("records the concrete automatic review failure reason", async () => {
    const rssFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `<?xml version="1.0"?><rss><channel><item><title>OpenAI 发布新能力</title><link>https://example.com/openai-new</link><description>能力摘要</description><pubDate>Wed, 29 Apr 2026 02:00:00 GMT</pubDate></item></channel></rss>`,
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
    generatePostReview.mockRejectedValueOnce(new Error("Review generation returned invalid JSON"))

    const { runDailyAiNews } = await import("@/lib/ai-news")
    const result = await runDailyAiNews({
      authorId: "admin-1",
      date: new Date("2026-04-29T08:00:00Z"),
      sources: [{ id: "openai", name: "OpenAI", feedUrl: "https://example.com/feed.xml" }],
      fetchImpl,
    })

    expect(updateAiNewsRun).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: expect.objectContaining({
        status: "SUCCEEDED",
        reviewSummary: "Automatic review failed: Review generation returned invalid JSON",
      }),
    })
    expect(result.autoReview).toEqual({
      published: false,
      error: "Automatic review failed: Review generation returned invalid JSON",
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

  test("selected source mode can temporarily run disabled sources without fallback", async () => {
    findFirst.mockResolvedValueOnce(null)
    findManyAiNewsSource.mockResolvedValueOnce([
      {
        id: "disabled",
        type: "RSS",
        name: "Disabled RSS",
        url: "https://example.com/disabled.xml",
        enabled: false,
        weight: 10,
        fetchLimit: null,
        minScore: null,
        config: null,
      },
    ])
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch

    const { runDailyAiNews } = await import("@/lib/ai-news")

    await expect(
      runDailyAiNews({
        authorId: "admin-1",
        date: new Date("2026-04-29T08:00:00Z"),
        sourceMode: "selected",
        sourceIds: ["disabled"],
        fetchImpl,
      }),
    ).rejects.toThrow("No AI news candidates available")

    expect(findManyAiNewsSource).toHaveBeenCalledWith({
      where: { id: { in: ["disabled"] } },
      orderBy: [{ weight: "desc" }, { name: "asc" }],
    })
    expect(fetchImpl).toHaveBeenCalledWith("https://example.com/disabled.xml", expect.any(Object))
    expect(updateAiNewsRun).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: {
        sourceSnapshotJson: [
          expect.objectContaining({
            id: "disabled",
            enabled: true,
            defaultEnabled: false,
          }),
        ],
      },
    })
  })
})
