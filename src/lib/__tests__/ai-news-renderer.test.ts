import { describe, expect, test } from "vitest"

import { renderDailyAiNewsMarkdown } from "@/lib/ai-news-renderer"
import type { AiNewsFactCard, AiNewsScoredCandidate } from "@/lib/ai-news-types"

type RichTestFactCard = AiNewsFactCard & Partial<{
  whatHappened: string
  whyItMatters: string
  keyDetails: string[]
  communityDiscussion: string
}>

function candidate(overrides: Partial<AiNewsScoredCandidate> = {}): AiNewsScoredCandidate {
  return {
    id: overrides.id ?? "candidate-1",
    sourceId: overrides.sourceId ?? "source-1",
    sourceType: overrides.sourceType ?? "RSS",
    sourceName: overrides.sourceName ?? "Source",
    title: overrides.title ?? "OpenAI 发布模型更新",
    url: overrides.url ?? "https://example.com/openai",
    canonicalUrl: overrides.canonicalUrl ?? overrides.url ?? "https://example.com/openai",
    summary: overrides.summary ?? "候选摘要",
    content: overrides.content,
    author: overrides.author,
    publishedAt: overrides.publishedAt ?? new Date("2026-05-05T08:00:00Z"),
    metadata: overrides.metadata,
    community: overrides.community,
    duplicateOfId: overrides.duplicateOfId,
    mergedSources: overrides.mergedSources,
    enrichment: overrides.enrichment,
    aiScore: overrides.aiScore ?? 8,
    aiReason: overrides.aiReason ?? "重要",
    aiSummary: overrides.aiSummary ?? "AI 摘要",
    aiTags: overrides.aiTags ?? [],
    aiRiskFlags: overrides.aiRiskFlags ?? [],
    scoreError: overrides.scoreError,
    selected: overrides.selected ?? true,
    selectionReason: overrides.selectionReason,
  }
}

function card(
  title: string,
  urls: string[],
  summary = "事实卡摘要",
  overrides: Partial<RichTestFactCard> = {},
): RichTestFactCard {
  return {
    title,
    summary,
    citations: urls.map((url) => ({ url, title })),
    confidence: "high",
    ...overrides,
  }
}

function render(
  selectedCandidates: AiNewsScoredCandidate[],
  factCards: AiNewsFactCard[],
) {
  return renderDailyAiNewsMarkdown({
    date: new Date("2026-05-05T08:00:00Z"),
    selectedCandidates,
    factCards,
    aiModel: {
      name: "文章摘要生成",
      model: "qwen3.5-flash",
    },
  })
}

describe("renderDailyAiNewsMarkdown", () => {
  test("renders required markdown sections and generator attribution", () => {
    const markdown = render(
      [
        candidate({ title: "开发者工具发布 SDK", sourceType: "GITHUB_RELEASES", aiTags: ["developer"] }),
        candidate({ id: "candidate-2", title: "新模型研究论文", sourceType: "RSS", url: "https://example.com/research", aiTags: ["research"] }),
        candidate({ id: "candidate-3", title: "AI 产品商业化", sourceType: "RSS", url: "https://example.com/product", aiTags: ["product"] }),
      ],
      [],
    )

    expect(markdown).toContain("欢迎来到【AI日报】栏目")
    expect(markdown).toContain("## 今日摘要")
    expect(markdown).toContain("## 今日重点")
    expect(markdown).toContain("【AiBase提要:】")
    expect(markdown).toContain("## 今日趋势总结")
    expect(markdown).toContain("## 来源链接")
    expect(markdown).toContain("生成标注：本文由 AI 模型")
    expect(markdown).toContain("文章摘要生成")
    expect(markdown).toContain("qwen3.5-flash")
  })

  test("does not render unselected candidate urls from extra fact cards", () => {
    const selected = candidate({ title: "入选新闻", url: "https://example.com/selected" })
    const markdown = render([selected], [
      card("未入选新闻", ["https://example.com/unselected"]),
      card("入选新闻", ["https://example.com/selected-citation"]),
    ])

    expect(markdown).toContain("https://example.com/selected-citation")
    expect(markdown).not.toContain("https://example.com/unselected")
  })

  test("ensures every selected candidate has a source link with candidate url fallback", () => {
    const selected = [
      candidate({ id: "candidate-1", title: "有引用新闻", url: "https://example.com/candidate-a" }),
      candidate({ id: "candidate-2", title: "无引用新闻", url: "https://example.com/candidate-b" }),
    ]
    const markdown = render(selected, [card("有引用新闻", ["https://example.com/citation-a"]), { title: "无引用新闻", summary: "摘要", citations: [] }])

    expect(markdown).toContain("https://example.com/citation-a")
    expect(markdown).toContain("https://example.com/candidate-b")
  })

  test("prefers Chinese summaries when a fact card summary is still English", () => {
    const markdown = render([
      candidate({
        title: "English upstream title",
        aiSummary: "这是中文编辑摘要。",
        summary: "Original English summary.",
      }),
    ], [card("English upstream title", ["https://example.com/citation"], "English fact-card summary.")])

    expect(markdown).toContain("这是中文编辑摘要")
    expect(markdown).not.toContain("English fact-card summary")
  })

  test("renders each selected story once in the detailed focus section", () => {
    const markdown = render([
      candidate({ id: "candidate-1", title: "开发者工具发布 SDK", sourceType: "GITHUB_RELEASES", aiTags: ["developer"] }),
      candidate({ id: "candidate-2", title: "新模型研究论文", sourceType: "RSS", url: "https://example.com/research", aiTags: ["research"] }),
      candidate({ id: "candidate-3", title: "AI 产品商业化", sourceType: "RSS", url: "https://example.com/product", aiTags: ["product"] }),
      candidate({ id: "candidate-4", title: "第二个开发者工具", sourceType: "GITHUB_RELEASES", url: "https://example.com/developer-2", aiTags: ["developer"] }),
    ], [])

    expect(markdown).toContain("今日共筛选出 4 条值得跟进的 AI 动态")
    expect(markdown.match(/^### \d+、/gm)).toHaveLength(4)
  })

  test("does not render legacy category sections", () => {
    const markdown = render([
      candidate({ title: "单条开发者工具", sourceType: "GITHUB_RELEASES", aiTags: ["developer"] }),
    ], [])

    expect(markdown).toContain("## 今日重点")
    expect(markdown).not.toContain("## 最重要的 3 件事")
    expect(markdown).not.toContain("## 开源与开发者动态")
    expect(markdown).not.toContain("暂无")
  })

  test("wraps English upstream titles in Chinese editorial labels", () => {
    const markdown = render([
      candidate({
        sourceType: "HACKERNEWS",
        sourceName: "Hacker News",
        title: "Useful AI coding agent",
        aiSummary: "开发者正在讨论 AI 编码代理的实用性。",
        summary: "Original English summary.",
      }),
    ], [])

    expect(markdown).toContain("### 1、Hacker News 社区讨论")
    expect(markdown).toContain("开发者正在讨论 AI 编码代理的实用性。")
    expect(markdown).not.toContain("### 1、Useful AI coding agent")
    expect(markdown).not.toContain("Original English summary")
  })

  test("disambiguates repeated generic editorial labels", () => {
    const markdown = render([
      candidate({
        id: "candidate-1",
        sourceType: "HACKERNEWS",
        sourceName: "Hacker News",
        title: "Useful AI coding agent",
        aiSummary: "开发者讨论第一条 AI 编码代理动态。",
      }),
      candidate({
        id: "candidate-2",
        sourceType: "HACKERNEWS",
        sourceName: "Hacker News",
        title: "How people use AI search",
        url: "https://example.com/hn-2",
        aiSummary: "开发者讨论第二条 AI 搜索动态。",
      }),
    ], [])

    expect(markdown).toContain("### 1、Hacker News 社区讨论（1）")
    expect(markdown).toContain("### 2、Hacker News 社区讨论（2）")
  })

  test("uses varied Chinese descriptors for RSS business stories", () => {
    const markdown = render([
      candidate({
        title: "Deepseek valuation jumps",
        aiSummary: "Deepseek 新一轮融资推动估值上升。",
      }),
      candidate({
        id: "candidate-2",
        title: "ChatGPT ads platform opens",
        url: "https://example.com/ads",
        aiSummary: "ChatGPT 广告平台面向小企业开放。",
      }),
      candidate({
        id: "candidate-3",
        title: "Anthropic cloud spending plan",
        url: "https://example.com/cloud",
        aiSummary: "Anthropic 扩大云基础设施投入。",
      }),
    ], [])

    expect(markdown).toContain("Deepseek 资本动态")
    expect(markdown).toContain("ChatGPT 商业化动态")
    expect(markdown).toContain("Anthropic 基础设施动态")
  })

  test("deduplicates repeated citation links in the source section", () => {
    const markdown = render(
      [candidate({ title: "重复引用新闻", url: "https://example.com/fallback" })],
      [card("重复引用新闻", ["https://example.com/shared", "https://example.com/shared"])],
    )
    const sourceSection = markdown.slice(markdown.indexOf("## 来源链接"))

    expect(sourceSection.match(/https:\/\/example\.com\/shared/g)).toHaveLength(1)
  })

  test("does not add noisy escapes for ordinary punctuation", () => {
    const markdown = render([
      candidate({ title: "ggml-org/llama.cpp b9045", aiSummary: "中文摘要。" }),
    ], [])

    expect(markdown).toContain("ggml-org/llama.cpp b9045")
    expect(markdown).not.toContain("ggml\\-org/llama\\.cpp")
  })

  test("renders news item with fact card key details as emoji bullets", () => {
    const markdown = render([
      candidate({ title: "OpenAI 发布实时语音模型", sourceName: "OpenAI Blog" }),
    ], [
      card("OpenAI 发布实时语音模型", ["https://example.com/openai"], "事实卡摘要", {
        whatHappened: "OpenAI 推出了新的实时语音模型，面向低延迟对话和转录场景。",
        keyDetails: [
          "模型支持更自然的实时语音对话。",
          "开发者可以把转录和翻译能力接入现有应用。",
        ],
        citations: [{ url: "https://example.com/openai", title: "OpenAI Blog", sourceName: "OpenAI Blog" }],
      }),
    ])

    expect(markdown).toContain("OpenAI 推出了新的实时语音模型")
    expect(markdown).toContain("🔊 模型支持更自然的实时语音对话。")
    expect(markdown).toContain("🌐 开发者可以把转录和翻译能力接入现有应用。")
    expect(markdown).toContain("> 来源：[OpenAI Blog](https://example.com/openai)")
  })

  test("renders trend summary section when fact cards are available", () => {
    const markdown = render([
      candidate({ title: "OpenAI 发布实时语音模型", aiTags: ["voice"] }),
      candidate({ id: "candidate-2", title: "AI SDK 发布新版本", sourceType: "GITHUB_RELEASES", url: "https://example.com/sdk", aiTags: ["sdk"] }),
      candidate({ id: "candidate-3", title: "AI 安全规范更新", url: "https://example.com/safety", aiTags: ["safety"] }),
    ], [
      card("OpenAI 发布实时语音模型", ["https://example.com/voice"], "语音模型摘要", {
        whyItMatters: "实时语音模型让多模态交互更容易进入客服、会议和翻译场景。",
      }),
      card("AI SDK 发布新版本", ["https://example.com/sdk"], "SDK 摘要", {
        whyItMatters: "开发者工具更新降低了把模型能力接入产品的门槛。",
      }),
      card("AI 安全规范更新", ["https://example.com/safety"], "安全摘要", {
        whyItMatters: "安全规范更新说明合规要求正在成为 AI 产品发布的基础环节。",
      }),
    ])

    expect(markdown).toContain("## 今日趋势总结")
    expect(markdown).toContain("多模态交互加速落地")
    expect(markdown).toContain("开发者工具链继续成熟")
    expect(markdown).toContain("安全与合规成为基础能力")
  })

  test("falls back to summary when fact card is missing", () => {
    const markdown = render([
      candidate({
        title: "缺少事实卡的新闻",
        url: "https://example.com/fallback",
        aiSummary: "这是缺少事实卡时的中文摘要。",
      }),
    ], [])

    expect(markdown).toContain("这是缺少事实卡时的中文摘要。")
    expect(markdown).toContain("🔊 这是缺少事实卡时的中文摘要。")
    expect(markdown).toContain("> 来源：[Source](https://example.com/fallback)")
  })
})
