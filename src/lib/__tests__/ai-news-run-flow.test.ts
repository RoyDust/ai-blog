/**
 * runDailyAiNews 编排行为测试。
 *
 * 打在 runDailyAiNews 单一接缝上：注入 fake run 仓储 + candidateRepository null（内存候选模式）
 * + 按 LLM 请求特征分发的 fake fetchImpl；ai-authoring、文章增强与模型解析（默认实现会查库）
 * 用 vi.mock 最小化替换，其余流水线（抓取/去重/评分/事实卡/渲染/草稿）走真实实现。
 *
 * 覆盖六条分支，只断言外部可观察行为（返回值、run 记录写入载荷、ai-authoring 调用参数）：
 * a. 同 slug 已存在且未发布 → SKIPPED + 发布既有草稿
 * b. regenerate → 更新既有文章
 * c. 不存在 → 创建 + 增强 + 发布，指标完整回写，generatedByAiNews 回写为 true
 *    （增强结果差异化传播到返回值与 run 记录；编辑简报合法时被渲染消费；
 *    qualityScore 夹具带 .5 尾数，钉住 round 而非 floor 的舍入方式）
 * d. 评分全不达标 → 回退选择候选，generationMode fallback、qualityScore 0
 * e. 步骤抛错 → run 记 FAILED 并 rethrow
 * f. 语义去重减员 → selectedCandidateCount 为去重后数量，被去重候选不进入正文与事实卡请求
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

// NotebookLM 分数带 .5 尾数：两候选均值 (9 + 8.5) / 2 = 8.75，×10 = 87.5，
// Math.round 得 88（floor 会得 87）——qualityScore 断言对舍入方式敏感。
const SCORE_BY_TITLE = new Map<string, Record<string, unknown>>([
  ["OpenAI 发布企业级代理", { score: 9, reason: "重大产品动态", summary: "OpenAI 发布企业级代理能力。", tags: ["agent"], riskFlags: [] }],
  ["NotebookLM adds developer APIs", { score: 8.5, reason: "开发者相关性高", summary: "NotebookLM 开放开发者 API。", tags: ["developer"], riskFlags: [] }],
])

// 合法编辑简报 fixture：形状对照 ai-news-editorial-compose.test.ts 的 validBrief，
// 字段长度满足 parseDailyAiNewsEditorialBrief 的最低质量门槛
// （intro ≥60、description ≥80、keyPoints ≥3 条且每条 ≥28 个实质字符）。
const EDITORIAL_BRIEF_INTRO =
  "今日 AI 生态的主线集中在企业级代理落地与开发者平台能力开放，两条新闻分别代表产品化推进与工具链完善的方向，说明平台方正在把模型能力转化为可集成的工程接口。"

const EDITORIAL_BRIEF_ITEM_OPENAI = {
  sourceTitle: "OpenAI 发布企业级代理",
  editorialTitle: "OpenAI 将企业级代理推向知识库与流程自动化",
  description:
    "OpenAI 把企业级代理能力扩展到内部知识库与业务流程场景，代理可以在权限边界内完成检索、任务拆解与后续动作编排，适合已经拥有成熟工作流的企业团队评估接入成本、治理要求与数据边界。",
  keyPoints: [
    "新能力围绕企业知识库、权限控制与任务编排展开，目标是降低代理在真实业务流程中的接入成本。",
    "对开发者而言，这更像一组可嵌入既有系统的代理能力，而不是面向普通用户的独立聊天入口。",
    "来源未提供完整性能指标与客户案例，实际落地效果仍需结合试点反馈继续验证。",
  ],
  impact: "这类更新会把企业采用 AI 的问题从模型选择推进到权限、数据边界与流程集成，技术团队需要更早评估治理成本。",
  sourceName: "OpenAI Blog",
  url: "https://example.com/openai-agent",
}

const EDITORIAL_BRIEF_ITEM_NOTEBOOKLM = {
  sourceTitle: "NotebookLM adds developer APIs",
  editorialTitle: "NotebookLM 面向开发者开放 API 接入",
  description:
    "NotebookLM 推出面向开发者的 API 接入能力，团队可以把笔记本检索与摘要能力嵌入自己的产品流程，减少重复搭建文档问答链路的工作量，同时需要关注配额限制与内容审核策略对集成方案的约束影响。",
  keyPoints: [
    "API 覆盖笔记本创建、来源管理与摘要查询等核心操作，便于程序化集成。",
    "开发者可以把该能力嵌入内部知识工具，降低自建检索链路的维护成本。",
    "接口配额与内容审核策略尚未完全公开，大规模接入前需要先行验证。",
  ],
  impact: "开发者工具链多了一个可直接复用的摘要与检索入口，中小团队可以更快搭建知识型产品。",
  sourceName: "OpenAI Blog",
  url: "https://example.com/notebooklm",
}

const VALID_EDITORIAL_BRIEF = {
  intro: EDITORIAL_BRIEF_INTRO,
  items: [EDITORIAL_BRIEF_ITEM_OPENAI, EDITORIAL_BRIEF_ITEM_NOTEBOOKLM],
  trends: [
    {
      title: "AI 能力从产品走向平台化开放",
      desc: "两条动态都指向同一个方向：模型能力不再只以终端产品形态交付，而是通过代理框架与开发者 API 开放给集成方。",
      evidenceTitles: ["OpenAI 将企业级代理推向知识库与流程自动化"],
    },
  ],
  warnings: [],
}

// 语义去重场景使用：去重后仅剩主候选（candidates.length = 1，简报条数门槛为 1），
// 简报只引用主候选，避免被去重候选经编辑稿回流进正文干扰断言。
const OPENAI_ONLY_EDITORIAL_BRIEF = {
  intro: EDITORIAL_BRIEF_INTRO,
  items: [EDITORIAL_BRIEF_ITEM_OPENAI],
  trends: [],
  warnings: [],
}

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
 * - 编辑简报与语义去重的响应可按用例注入（默认简报不达标、去重为空）
 */
function createPipelineFetch({
  scoreByTitle,
  draftResponse,
  editorialBriefPayload = { intro: "太短", items: [], trends: [] },
  dedupePayload = { duplicateGroups: [] },
}: {
  scoreByTitle: Map<string, Record<string, unknown>>
  draftResponse?: unknown
  editorialBriefPayload?: unknown
  dedupePayload?: unknown
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
        return chatResponse(dedupePayload)
      }

      if (userContent.includes("Create a conservative fact card")) {
        const title = Array.from(scoreByTitle.keys()).find((key) => userContent.includes(`Title: ${key}`)) ?? ""
        return chatResponse(factCardResponse(title))
      }

      if (userContent.includes("日级主编稿")) {
        // 默认返回不达标简报 → 流水线走降级路径（brief 为 null 仍可渲染发布）；
        // 注入合法简报的用例借此验证"简报请求发出且被渲染消费"
        return chatResponse(editorialBriefPayload)
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
    // 增强结果返回与草稿值不同的差异化字段（形状对照 AiNewsPostEnhancementResult.post / PostForAi），
    // 钉住 entry.ts 的 {...post, ...enhancedPost} 合并：增强值必须覆盖草稿值，
    // 并传播到返回值 post 与 run 记录的 postTitle——若增强结果被丢弃，这些断言会红。
    mocks.applyAiNewsPostEnhancements.mockResolvedValueOnce({
      post: {
        id: "post-1",
        title: "增强后标题",
        slug: RUN_SLUG,
        content: "增强后正文",
        excerpt: "增强后摘要",
        seoDescription: "增强后 SEO 描述",
        category: null,
        tags: [{ id: "tag-1", name: "AI 日报" }],
        published: false,
        coverImage: null,
      },
      applied: [
        { action: "summary", source: "ai" },
        { action: "seo-description", source: "ai" },
        { action: "tags", source: "ai" },
      ],
      skipped: ["category", "cover-image"],
      failed: [],
    })
    const fetchImpl = createPipelineFetch({ scoreByTitle: SCORE_BY_TITLE, editorialBriefPayload: VALID_EDITORIAL_BRIEF })

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
        // 编辑简报请求已发出且被渲染消费：合法简报的 intro 进入最终正文
        //（若简报请求未发出或渲染走了降级路径，intro 不会出现在 content 中）
        content: expect.stringContaining(EDITORIAL_BRIEF_INTRO),
      }),
    })
    const createdContent =
      (mocks.createAdminPost.mock.calls[0]?.[0] as { input?: { content?: string } } | undefined)?.input?.content ?? ""
    // candidate-pipeline 模式正文来自确定性渲染，保留来源 URL 与编辑简报条目标题
    expect(createdContent).toContain("https://example.com/openai-agent")
    expect(createdContent).toContain("OpenAI 将企业级代理推向知识库与流程自动化")
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
        // (9 + 8.5) / 2 × 10 = 87.5 → Math.round = 88；若实现误用 floor 会得 87
        qualityScore: 88,
        citationCoverage: 1,
        generationMode: "candidate-pipeline",
        postId: "post-1",
        // postTitle 传播增强后的标题（enhancementResult.post 覆盖草稿标题）
        postTitle: "增强后标题",
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
      // 返回值传播增强结果：title/excerpt 来自 enhancedPost 而非草稿值
      post: { id: "post-1", slug: RUN_SLUG, published: true, title: "增强后标题", excerpt: "增强后摘要" },
      sourceCount: 2,
      metrics: {
        rawCandidateCount: 2,
        dedupedCandidateCount: 2,
        scoredCandidateCount: 2,
        selectedCandidateCount: 2,
        sourceFailureJson: [],
        qualityScore: 88,
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

  test("branch f: semantic dedupe shrinkage reflects in run-level selectedCandidateCount and dropped candidates never reach draft or fact cards", async () => {
    const runRepository = createRunRepository(null)
    mocks.createAdminPost.mockResolvedValueOnce({ id: "post-1", title: DRAFT_RESPONSE.title, slug: RUN_SLUG, published: false })
    mocks.publishAiDraftPost.mockResolvedValueOnce({ id: "post-1", published: true })
    // 复用 branch c 装置，仅让语义去重返回"NotebookLM 是 OpenAI 代理动态的重复"；
    // 候选 id 由 fetchers 按 `${sourceId}:${canonicalUrl}` 生成。
    const fetchImpl = createPipelineFetch({
      scoreByTitle: SCORE_BY_TITLE,
      editorialBriefPayload: OPENAI_ONLY_EDITORIAL_BRIEF,
      dedupePayload: {
        duplicateGroups: [
          { primaryId: "openai:https://example.com/openai-agent", duplicateIds: ["openai:https://example.com/notebooklm"] },
        ],
      },
    })

    const result = await runDailyAiNews({
      authorId: "admin-1",
      date: RUN_DATE,
      fetchImpl,
      runRepository,
      candidateRepository: null,
    })

    // (a) run 级指标反映去重后的数量：selection 原始选 2，语义去重后保留 1；
    // qualityScore 仍按去重前的 selection 均值 (9 + 8.5) / 2 × 10 = 87.5 → 88
    expect(result).toMatchObject({
      operation: "created",
      published: true,
      metrics: {
        rawCandidateCount: 2,
        dedupedCandidateCount: 2,
        scoredCandidateCount: 2,
        selectedCandidateCount: 1,
        citationCoverage: 1,
        qualityScore: 88,
        generationMode: "candidate-pipeline",
      },
      run: { id: "run-1", status: "SUCCEEDED" },
    })
    expect(runRepository.aiNewsRun.update).toHaveBeenLastCalledWith({
      where: { id: "run-1" },
      data: expect.objectContaining({
        status: "SUCCEEDED",
        selectedCandidateCount: 1,
      }),
    })

    // (b) 被去重候选不进入正文，主候选保留
    const createdContent =
      (mocks.createAdminPost.mock.calls[0]?.[0] as { input?: { content?: string } } | undefined)?.input?.content ?? ""
    expect(createdContent).toContain("https://example.com/openai-agent")
    expect(createdContent).not.toContain("NotebookLM")
    expect(createdContent).not.toContain("https://example.com/notebooklm")

    // (c) 事实卡请求只为保留候选发出（事实卡在去重后的 selectedCandidates 上生成）
    const factCardPrompts = fetchImpl.mock.calls
      .filter(([, init]) => init?.method === "POST")
      .map(([, init]) => {
        const body = JSON.parse(String(init?.body)) as { messages?: Array<{ content?: string }> }
        return body.messages?.map((message) => String(message.content)).join("\n") ?? ""
      })
      .filter((text) => text.includes("Create a conservative fact card"))
    expect(factCardPrompts).toHaveLength(1)
    expect(factCardPrompts[0]).toContain("Title: OpenAI 发布企业级代理")
    expect(factCardPrompts[0]).not.toContain("NotebookLM")
  })
})
