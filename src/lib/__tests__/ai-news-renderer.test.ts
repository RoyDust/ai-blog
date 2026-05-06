import { describe, expect, test } from "vitest"

import { renderDailyAiNewsMarkdown } from "@/lib/ai-news-renderer"
import type { AiNewsFactCard, AiNewsScoredCandidate, AiNewsSourceType } from "@/lib/ai-news-types"

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

function card(title: string, urls: string[], summary = "事实卡摘要"): AiNewsFactCard {
  return {
    title,
    summary,
    citations: urls.map((url) => ({ url, title })),
    confidence: "high",
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
        candidate({ id: "candidate-4", title: "第二个开发者工具", sourceType: "GITHUB_RELEASES", url: "https://example.com/developer-2", aiTags: ["developer"] }),
        candidate({ id: "candidate-5", title: "第二篇模型论文", sourceType: "RSS", url: "https://example.com/research-2", aiTags: ["research"] }),
        candidate({ id: "candidate-6", title: "第二个商业产品", sourceType: "RSS", url: "https://example.com/product-2", aiTags: ["product"] }),
      ],
      [],
    )

    expect(markdown).toContain("## 今日摘要")
    expect(markdown).toContain("## 最重要的 3 件事")
    expect(markdown).toContain("## 开源与开发者动态")
    expect(markdown).toContain("## 模型与研究进展")
    expect(markdown).toContain("## 产品与商业动态")
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
    expect(markdown).not.toContain("English fact\\-card summary")
  })

  test("renders each selected story once in editorial sections", () => {
    const markdown = render([
      candidate({ id: "candidate-1", title: "开发者工具发布 SDK", sourceType: "GITHUB_RELEASES", aiTags: ["developer"] }),
      candidate({ id: "candidate-2", title: "新模型研究论文", sourceType: "RSS", url: "https://example.com/research", aiTags: ["research"] }),
      candidate({ id: "candidate-3", title: "AI 产品商业化", sourceType: "RSS", url: "https://example.com/product", aiTags: ["product"] }),
      candidate({ id: "candidate-4", title: "第二个开发者工具", sourceType: "GITHUB_RELEASES", url: "https://example.com/developer-2", aiTags: ["developer"] }),
    ], [])

    expect(markdown).toContain("今日共筛选出 4 条值得跟进的 AI 动态")
    expect(markdown.match(/^- \*\*/gm)).toHaveLength(4)
  })

  test("omits empty category sections after top-story dedupe", () => {
    const markdown = render([
      candidate({ title: "单条开发者工具", sourceType: "GITHUB_RELEASES", aiTags: ["developer"] }),
    ], [])

    expect(markdown).toContain("## 最重要的 3 件事")
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

    expect(markdown).toContain("**Hacker News 社区讨论**：开发者正在讨论 AI 编码代理的实用性。")
    expect(markdown).not.toContain("**Useful AI coding agent**")
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

    expect(markdown).toContain("**Hacker News 社区讨论（1）**")
    expect(markdown).toContain("**Hacker News 社区讨论（2）**")
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

    expect(markdown).toContain("**Deepseek 资本动态**")
    expect(markdown).toContain("**ChatGPT 商业化动态**")
    expect(markdown).toContain("**Anthropic 基础设施动态**")
  })

  test("deduplicates repeated citation links", () => {
    const markdown = render(
      [candidate({ title: "重复引用新闻", url: "https://example.com/fallback" })],
      [card("重复引用新闻", ["https://example.com/shared", "https://example.com/shared"])],
    )

    expect(markdown.match(/https:\/\/example\.com\/shared/g)).toHaveLength(1)
  })

  test("does not add noisy escapes for ordinary punctuation", () => {
    const markdown = render([
      candidate({ title: "ggml-org/llama.cpp b9045", aiSummary: "中文摘要。" }),
    ], [])

    expect(markdown).toContain("ggml-org/llama.cpp b9045")
    expect(markdown).not.toContain("ggml\\-org/llama\\.cpp")
  })

  test.each([
    ["GITHUB_RELEASES" as AiNewsSourceType, "## 开源与开发者动态", "开发者工具"],
    ["RSS" as AiNewsSourceType, "## 模型与研究进展", "模型研究"],
    ["RSS" as AiNewsSourceType, "## 产品与商业动态", "商业产品"],
  ])("classifies %s candidates into expected section", (sourceType, section, title) => {
    const markdown = render([
      candidate({ id: "top-1", title: "顶部新闻一", sourceType: "RSS", url: "https://example.com/top-1", aiTags: ["product"] }),
      candidate({ id: "top-2", title: "顶部新闻二", sourceType: "RSS", url: "https://example.com/top-2", aiTags: ["product"] }),
      candidate({ id: "top-3", title: "顶部新闻三", sourceType: "RSS", url: "https://example.com/top-3", aiTags: ["product"] }),
      candidate({
        id: "target",
        sourceType,
        title,
        url: `https://example.com/${title}`,
        aiTags: title.includes("模型") ? ["research"] : title.includes("商业") ? ["product"] : [],
      }),
    ], [])
    const sectionIndex = markdown.indexOf(section)
    const titleIndex = markdown.indexOf(title, sectionIndex)

    expect(sectionIndex).toBeGreaterThanOrEqual(0)
    expect(titleIndex).toBeGreaterThan(sectionIndex)
  })
})
