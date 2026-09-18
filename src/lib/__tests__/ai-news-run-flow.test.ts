/**
 * runDailyAiNews 编排行为测试。
 *
 * 打在 runDailyAiNews 单一接缝上：注入 fake run 仓储 + candidateRepository null（内存候选模式）
 * + 按 LLM 请求特征分发的 fake fetchImpl；ai-authoring、文章增强与模型解析（默认实现会查库）
 * 用 vi.mock 最小化替换，其余流水线（抓取/去重/评分/事实卡/渲染/草稿）走真实实现。
 *
 * 覆盖五条分支，只断言外部可观察行为（返回值、run 记录写入载荷、ai-authoring 调用参数）：
 * a. 同 slug 已存在且未发布 → SKIPPED + 发布既有草稿
 * b. regenerate → 更新既有文章
 * c. 不存在 → 创建 + 增强 + 发布，指标完整回写，generatedByAiNews 回写为 true
 * d. 评分全不达标 → 回退选择候选，generationMode fallback、qualityScore 0
 * e. 步骤抛错 → run 记 FAILED 并 rethrow
 */
import { beforeEach, describe, expect, test, vi } from "vitest"

import { DEFAULT_AI_NEWS_SOURCES } from "@/lib/ai-news/default-sources"
import type { AiModelOption } from "@/lib/ai-models"
import { runDailyAiNews } from "@/lib/ai-news/run/entry"

const mocks = vi.hoisted(() => ({
  resolveDailyAiNewsModel: vi.fn(),
  createAdminPost: vi.fn(),
  updateAdminPost: vi.fn(),
  publishAiDraftPost: vi.fn(),
  applyAiNewsPostEnhancements: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}))

// 仅替换模型解析（真实实现会查询数据库），保留真实的 generateDailyAiNewsDraft 走 fake fetchImpl。
vi.mock("@/lib/ai-news/draft-flow", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai-news/draft-flow")>()
  return {
    ...actual,
    resolveDailyAiNewsModel: mocks.resolveDailyAiNewsModel,
  }
})

vi.mock("@/lib/ai-authoring", () => ({
  createAdminPost: mocks.createAdminPost,
  updateAdminPost: mocks.updateAdminPost,
  publishAiDraftPost: mocks.publishAiDraftPost,
}))

vi.mock("@/lib/ai-news/post-processing", () => ({
  applyAiNewsPostEnhancements: mocks.applyAiNewsPostEnhancements,
}))

const RUN_DATE = new Date("2026-04-29T08:00:00.000Z")
const RUN_SLUG = "ai-daily-2026-04-29"
const LLM_CHAT_URL = "https://llm.test/v1/chat/completions"
// 默认源清单中的 openai 源；fake run 仓储不带 aiNewsSource → 回退默认源，只有该源产出条目。
const FEED_URL = "https://openai.com/news/rss.xml"

const DRAFT_RESPONSE = {
  title: "2026-04-29 AI 日报：代理与产品更新",
  excerpt: "今日 AI 新闻聚焦企业级代理进展与开发者产品动态。",
  content: "# 今日摘要\n\n- OpenAI 发布企业级代理。\n- NotebookLM 推出开发者 API。\n\n## 来源链接",
}

const FEED_XML = `<?xml version="1.0"?><rss><channel>
  <item><title>OpenAI 发布企业级代理</title><link>https://example.com/openai-agent</link><description>面向企业的代理能力更新。</description><pubDate>Wed, 29 Apr 2026 02:00:00 GMT</pubDate></item>
  <item><title>NotebookLM adds developer APIs</title><link>https://example.com/notebooklm</link><description>较小的产品更新。</description><pubDate>Wed, 29 Apr 2026 01:00:00 GMT</pubDate></item>
</channel></rss>`

const EMPTY_FEED_XML = `<?xml version="1.0"?><rss><channel></channel></rss>`

const CANDIDATE_URLS: Record<string, string> = {
  "OpenAI 发布企业级代理": "https://example.com/openai-agent",
  "NotebookLM adds developer APIs": "https://example.com/notebooklm",
}

const SCORE_BY_TITLE = new Map<string, Record<string, unknown>>([
  ["OpenAI 发布企业级代理", { score: 9, reason: "重大产品动态", summary: "OpenAI 发布企业级代理能力。", tags: ["agent"], riskFlags: [] }],
  ["NotebookLM adds developer APIs", { score: 8, reason: "开发者相关性高", summary: "NotebookLM 开放开发者 API。", tags: ["developer"], riskFlags: [] }],
])

const fakeAiModel: AiModelOption = {
  id: "model-fixture",
  name: "日报测试模型",
  description: "编排行为测试用模型",
  provider: "openai-compatible",
  baseUrl: "https://llm.test/v1",
  requestPath: "/chat/completions",
  model: "daily-behavior-test",
  apiKey: "test-key",
  apiKeyEnv: "AI_OPENAI_COMPAT_API_KEY",
  baseUrlEnv: "AI_OPENAI_COMPAT_BASE_URL",
  modelEnv: "AI_OPENAI_COMPAT_MODEL",
  capabilities: ["post-summary"],
  defaultFor: [],
  source: "environment",
  editable: false,
  deletable: false,
  enabled: true,
  status: "ready",
  hasApiKey: true,
}

type ExistingPost = { id: string; title: string; slug: string; published: boolean }

function createRunRepository(existingPost: ExistingPost | null = null) {
  return {
    aiNewsRun: {
      create: vi.fn(async () => ({ id: "run-1" })),
      update: vi.fn(async () => ({})),
    },
    post: {
      findFirst: vi.fn(async () => existingPost),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
  }
}

function jsonResponse(json: unknown, status = 200) {
  return new Response(JSON.stringify(json), { status })
}

function textResponse(text: string, status = 200) {
  return new Response(text, { status })
}

function chatResponse(content: unknown) {
  return jsonResponse({
    choices: [{ message: { content: typeof content === "string" ? content : JSON.stringify(content) } }],
  })
}

function factCardResponse(title: string) {
  return {
    title,
    summary: `${title} 的核心事实摘要。`,
    whatHappened: `${title} 公布了新的进展。`,
    whyItMatters: "该进展会影响相关产品的使用方式。",
    keyDetails: ["官方渠道发布了对应说明。"],
    limitations: ["效果仍需结合实际场景验证。"],
    communityDiscussion: "",
    citations: [{ title, url: CANDIDATE_URLS[title] ?? "https://example.com/unknown" }],
    confidence: "medium",
    warnings: [],
  }
}

/**
 * 按请求特征分发：
 * - LLM 调用根据 user prompt 关键词返回评分 / 语义去重 / 事实卡 / 编辑简报 / 草稿响应
 * - 默认源中的 RSS feed 返回条目（openai）或空 feed（其余），GitHub Releases 返回空列表
 */
function createPipelineFetch({
  scoreByTitle,
  draftResponse,
}: {
  scoreByTitle: Map<string, Record<string, unknown>>
  draftResponse?: unknown
}) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)

    if (url === LLM_CHAT_URL && init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as { messages?: Array<{ role?: string; content?: string }> }
      const userContent = String(body.messages?.find((message) => message.role === "user")?.content ?? "")

      if (userContent.includes("score/reason/summary/tags/riskFlags")) {
        const title = Array.from(scoreByTitle.keys()).find((key) => userContent.includes(`Title: ${key}`))
        return chatResponse(
          scoreByTitle.get(title ?? "") ?? { score: 0, reason: "未匹配候选", summary: "低分候选。", tags: [], riskFlags: [] },
        )
      }

      if (userContent.includes("deduplicate AI news candidates")) {
        return chatResponse({ duplicateGroups: [] })
      }

      if (userContent.includes("Create a conservative fact card")) {
        const title = Array.from(scoreByTitle.keys()).find((key) => userContent.includes(`Title: ${key}`)) ?? ""
        return chatResponse(factCardResponse(title))
      }

      if (userContent.includes("日级主编稿")) {
        // 编辑简报返回不达标内容 → 流水线走降级路径（brief 为 null 仍可渲染发布）
        return chatResponse({ intro: "太短", items: [], trends: [] })
      }

      if (userContent.includes("请基于候选新闻生成一篇中文 AI 新闻日报博客")) {
        return chatResponse(draftResponse ?? DRAFT_RESPONSE)
      }

      return chatResponse("")
    }

    if (url.startsWith("https://api.github.com/")) {
      return jsonResponse([])
    }

    if (url === FEED_URL) {
      return textResponse(FEED_XML)
    }

    return textResponse(EMPTY_FEED_XML)
  })
}

describe("runDailyAiNews orchestration behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolveDailyAiNewsModel.mockResolvedValue(fakeAiModel)
    mocks.applyAiNewsPostEnhancements.mockResolvedValue({ post: null, applied: [], skipped: [], failed: [] })
  })

  test("branch a: existing unpublished slug publishes the draft, records SKIPPED, and returns operation skipped", async () => {
    const runRepository = createRunRepository({ id: "post-existing", title: "已存在草稿", slug: RUN_SLUG, published: false })
    mocks.publishAiDraftPost.mockResolvedValueOnce({ id: "post-existing", published: true })
    const fetchImpl = vi.fn()

    const result = await runDailyAiNews({
      authorId: "admin-1",
      date: RUN_DATE,
      fetchImpl: fetchImpl as unknown as typeof fetch,
      runRepository,
      candidateRepository: null,
    })

    // 跳过分支不做任何抓取与生成
    expect(fetchImpl).not.toHaveBeenCalled()
    expect(mocks.createAdminPost).not.toHaveBeenCalled()
    expect(mocks.updateAdminPost).not.toHaveBeenCalled()
    expect(mocks.applyAiNewsPostEnhancements).not.toHaveBeenCalled()

    expect(mocks.publishAiDraftPost).toHaveBeenCalledWith({ postId: "post-existing" })
    expect(runRepository.aiNewsRun.create).toHaveBeenCalledWith({
      data: { runDate: RUN_DATE, trigger: "MANUAL", status: "RUNNING" },
    })
    expect(runRepository.aiNewsRun.update).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: expect.objectContaining({
        status: "SKIPPED",
        sourceCount: 0,
        failureCount: 0,
        rawCandidateCount: 0,
        dedupedCandidateCount: 0,
        scoredCandidateCount: 0,
        selectedCandidateCount: 0,
        postId: "post-existing",
        postTitle: "已存在草稿",
        postSlug: RUN_SLUG,
        published: true,
      }),
    })
    expect(runRepository.post.updateMany).toHaveBeenCalledWith({
      where: { id: "post-existing", generatedByAiNews: false },
      data: { generatedByAiNews: true },
    })
    expect(result).toMatchObject({
      operation: "skipped",
      reason: "Daily AI news already exists",
      published: true,
      post: { id: "post-existing", title: "已存在草稿", slug: RUN_SLUG, published: true },
      sourceCount: 0,
      failures: [],
      run: { id: "run-1", status: "SKIPPED" },
    })
  })

  test("branch b: regenerate updates the existing published post and returns operation regenerated", async () => {
    const runRepository = createRunRepository({ id: "post-existing", title: "旧日报", slug: RUN_SLUG, published: true })
    mocks.updateAdminPost.mockResolvedValueOnce({ id: "post-existing", slug: RUN_SLUG, published: true })
    const fetchImpl = createPipelineFetch({ scoreByTitle: SCORE_BY_TITLE })

    const result = await runDailyAiNews({
      authorId: "admin-1",
      date: RUN_DATE,
      regenerate: true,
      fetchImpl,
      runRepository,
      candidateRepository: null,
    })

    expect(mocks.createAdminPost).not.toHaveBeenCalled()
    expect(mocks.updateAdminPost).toHaveBeenCalledWith({
      id: "post-existing",
      input: expect.objectContaining({
        title: DRAFT_RESPONSE.title,
        slug: RUN_SLUG,
        excerpt: DRAFT_RESPONSE.excerpt,
        published: true,
        generatedByAiNews: true,
      }),
    })
    // 已发布文章重新生成时不再重复发布
    expect(mocks.publishAiDraftPost).not.toHaveBeenCalled()
    expect(runRepository.aiNewsRun.update).toHaveBeenCalledWith({
      where: { id: "run-1" },
      data: expect.objectContaining({
        status: "SUCCEEDED",
        postId: "post-existing",
        postTitle: DRAFT_RESPONSE.title,
        postSlug: RUN_SLUG,
        published: true,
        generationMode: "candidate-pipeline",
      }),
    })
    expect(result).toMatchObject({
      operation: "regenerated",
      published: true,
      post: { id: "post-existing", slug: RUN_SLUG, published: true },
      run: { id: "run-1", status: "SUCCEEDED" },
    })
  })

  test("branch c: fresh run creates, enhances, and publishes the post with full metrics and generatedByAiNews writeback", async () => {
    const runRepository = createRunRepository(null)
    mocks.createAdminPost.mockResolvedValueOnce({ id: "post-1", title: DRAFT_RESPONSE.title, slug: RUN_SLUG, published: false })
    mocks.publishAiDraftPost.mockResolvedValueOnce({ id: "post-1", published: true })
    const fetchImpl = createPipelineFetch({ scoreByTitle: SCORE_BY_TITLE })

    const result = await runDailyAiNews({
      authorId: "admin-1",
      date: RUN_DATE,
      fetchImpl,
      runRepository,
      candidateRepository: null,
    })

    expect(mocks.createAdminPost).toHaveBeenCalledWith({
      authorId: "admin-1",
      input: expect.objectContaining({
        title: DRAFT_RESPONSE.title,
        slug: RUN_SLUG,
        excerpt: DRAFT_RESPONSE.excerpt,
        published: false,
        generatedByAiNews: true,
        // candidate-pipeline 模式正文来自确定性渲染，保留来源 URL
        content: expect.stringContaining("https://example.com/openai-agent"),
      }),
    })
    expect(mocks.applyAiNewsPostEnhancements).toHaveBeenCalledWith({ postId: "post-1", modelId: undefined })
    // 发布时序：先增强，后发布
    const enhancementOrder = mocks.applyAiNewsPostEnhancements.mock.invocationCallOrder[0] ?? 0
    const publishOrder = mocks.publishAiDraftPost.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER
    expect(enhancementOrder).toBeLessThan(publishOrder)
    expect(mocks.publishAiDraftPost).toHaveBeenCalledWith({ postId: "post-1" })

    // run 记录：sourceSnapshotJson 一次 + 收尾一次
    expect(runRepository.aiNewsRun.update).toHaveBeenCalledTimes(2)
    expect(runRepository.aiNewsRun.update).toHaveBeenLastCalledWith({
      where: { id: "run-1" },
      data: expect.objectContaining({
        status: "SUCCEEDED",
        sourceCount: 2,
        failureCount: 0,
        rawCandidateCount: 2,
        dedupedCandidateCount: 2,
        scoredCandidateCount: 2,
        selectedCandidateCount: 2,
        sourceFailureJson: null,
        qualityScore: 85,
        citationCoverage: 1,
        generationMode: "candidate-pipeline",
        postId: "post-1",
        postTitle: DRAFT_RESPONSE.title,
        postSlug: RUN_SLUG,
        published: true,
        reviewVerdict: null,
        reviewScore: null,
        reviewSummary: null,
      }),
    })
    expect(runRepository.post.updateMany).toHaveBeenCalledWith({
      where: { id: "post-1", generatedByAiNews: false },
      data: { generatedByAiNews: true },
    })

    expect(result).toMatchObject({
      operation: "created",
      published: true,
      post: { id: "post-1", slug: RUN_SLUG, published: true },
      sourceCount: 2,
      metrics: {
        rawCandidateCount: 2,
        dedupedCandidateCount: 2,
        scoredCandidateCount: 2,
        selectedCandidateCount: 2,
        sourceFailureJson: [],
        qualityScore: 85,
        citationCoverage: 1,
        generationMode: "candidate-pipeline",
        configuredSourceCount: DEFAULT_AI_NEWS_SOURCES.length,
      },
      generatedBy: { id: fakeAiModel.id, name: fakeAiModel.name, model: fakeAiModel.model },
      run: { id: "run-1", status: "SUCCEEDED" },
    })
  })

  test("branch d: all candidates below the score threshold falls back to newest candidates with generationMode fallback and qualityScore 0", async () => {
    const runRepository = createRunRepository(null)
    mocks.createAdminPost.mockResolvedValueOnce({ id: "post-1", title: DRAFT_RESPONSE.title, slug: RUN_SLUG, published: false })
    mocks.publishAiDraftPost.mockResolvedValueOnce({ id: "post-1", published: true })
    const lowScores = new Map<string, Record<string, unknown>>([
      ["OpenAI 发布企业级代理", { score: 1, reason: "弱相关", summary: "相关性较弱。", tags: [], riskFlags: [] }],
      ["NotebookLM adds developer APIs", { score: 2, reason: "弱相关", summary: "相关性较弱。", tags: [], riskFlags: [] }],
    ])
    const fetchImpl = createPipelineFetch({ scoreByTitle: lowScores })

    const result = await runDailyAiNews({
      authorId: "admin-1",
      date: RUN_DATE,
      fetchImpl,
      runRepository,
      candidateRepository: null,
    })

    // 回退路径仍会创建并发布文章
    expect(mocks.createAdminPost).toHaveBeenCalledWith({
      authorId: "admin-1",
      input: expect.objectContaining({
        title: DRAFT_RESPONSE.title,
        slug: RUN_SLUG,
        published: false,
        generatedByAiNews: true,
      }),
    })
    expect(mocks.publishAiDraftPost).toHaveBeenCalledWith({ postId: "post-1" })

    expect(result).toMatchObject({
      operation: "created",
      published: true,
      metrics: {
        rawCandidateCount: 2,
        dedupedCandidateCount: 2,
        scoredCandidateCount: 2,
        selectedCandidateCount: 2,
        qualityScore: 0,
        generationMode: "fallback",
      },
      run: { id: "run-1", status: "SUCCEEDED" },
    })
    expect(runRepository.aiNewsRun.update).toHaveBeenLastCalledWith({
      where: { id: "run-1" },
      data: expect.objectContaining({
        status: "SUCCEEDED",
        qualityScore: 0,
        generationMode: "fallback",
        selectedCandidateCount: 2,
        postId: "post-1",
        published: true,
      }),
    })

    // 回退模式跳过语义去重 / 事实卡 / 编辑简报，只保留评分与 legacy 草稿调用
    const promptTexts = fetchImpl.mock.calls
      .filter(([, init]) => init?.method === "POST")
      .map(([, init]) => {
        const body = JSON.parse(String(init?.body)) as { messages?: Array<{ content?: string }> }
        return body.messages?.map((message) => String(message.content)).join("\n") ?? ""
      })
      .join("\n")
    expect(promptTexts).toContain("score/reason/summary/tags/riskFlags")
    expect(promptTexts).not.toContain("deduplicate AI news candidates")
    expect(promptTexts).not.toContain("Create a conservative fact card")
    expect(promptTexts).not.toContain("日级主编稿")
  })

  test("branch e: draft step failure records a FAILED run with failureCount and error message before rethrowing", async () => {
    const runRepository = createRunRepository(null)
    // 草稿调用返回空内容 → generateDailyAiNewsDraft 抛错
    const fetchImpl = createPipelineFetch({ scoreByTitle: SCORE_BY_TITLE, draftResponse: "" })

    await expect(
      runDailyAiNews({
        authorId: "admin-1",
        date: RUN_DATE,
        fetchImpl,
        runRepository,
        candidateRepository: null,
      }),
    ).rejects.toThrow("AI news generation returned invalid JSON")

    expect(mocks.createAdminPost).not.toHaveBeenCalled()
    expect(mocks.publishAiDraftPost).not.toHaveBeenCalled()

    expect(runRepository.aiNewsRun.update).toHaveBeenCalledTimes(2)
    expect(runRepository.aiNewsRun.update).toHaveBeenLastCalledWith({
      where: { id: "run-1" },
      data: expect.objectContaining({
        status: "FAILED",
        sourceCount: 2,
        rawCandidateCount: 2,
        failureCount: 1,
        error: "AI news generation returned invalid JSON",
        generationMode: "candidate-pipeline",
      }),
    })
    expect(runRepository.post.updateMany).not.toHaveBeenCalled()
  })
})
