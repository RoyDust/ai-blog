import { describe, expect, test, vi } from "vitest"

import type { AiModelOption } from "@/lib/ai-models"
import {
  buildDailyAiNewsEditorialPrompt,
  generateDailyAiNewsEditorialBrief,
  parseDailyAiNewsEditorialBrief,
} from "@/lib/ai-news-editorial-compose"
import type { AiNewsFactCard, AiNewsScoredCandidate } from "@/lib/ai-news-types"

function candidate(overrides: Partial<AiNewsScoredCandidate> = {}): AiNewsScoredCandidate {
  return {
    id: overrides.id ?? "candidate-1",
    sourceId: overrides.sourceId ?? "source-1",
    sourceType: overrides.sourceType ?? "RSS",
    sourceName: overrides.sourceName ?? "OpenAI Blog",
    title: overrides.title ?? "OpenAI 发布企业级代理",
    url: overrides.url ?? "https://example.com/openai-agent",
    canonicalUrl: overrides.canonicalUrl ?? overrides.url ?? "https://example.com/openai-agent",
    summary: overrides.summary ?? "OpenAI 发布面向企业流程的代理能力。",
    content: overrides.content,
    author: overrides.author,
    publishedAt: overrides.publishedAt ?? new Date("2026-05-13T08:00:00Z"),
    metadata: overrides.metadata,
    community: overrides.community,
    duplicateOfId: overrides.duplicateOfId,
    mergedSources: overrides.mergedSources,
    enrichment: overrides.enrichment,
    aiScore: overrides.aiScore ?? 9,
    aiReason: overrides.aiReason ?? "高价值企业代理动态",
    aiSummary: overrides.aiSummary ?? "OpenAI 将代理能力推进到企业内部知识库和工作流场景。",
    aiTags: overrides.aiTags ?? ["agent", "enterprise"],
    aiRiskFlags: overrides.aiRiskFlags ?? [],
    scoreError: overrides.scoreError,
    selected: overrides.selected ?? true,
    selectionReason: overrides.selectionReason,
  }
}

function factCard(overrides: Partial<AiNewsFactCard> = {}): AiNewsFactCard {
  return {
    title: overrides.title ?? "OpenAI 发布企业级代理",
    summary: overrides.summary ?? "OpenAI 发布企业代理更新，重点面向知识库和流程自动化。",
    citations: overrides.citations ?? [{ title: "OpenAI Blog", url: "https://example.com/openai-agent", sourceName: "OpenAI Blog" }],
    confidence: overrides.confidence ?? "high",
    ...overrides,
  }
}

const validBrief = {
  intro: "今天的 AI 生态主线集中在开发者工具、企业级代理和模型基础设施三个方向，几个更新都指向更实际的产品落地和工程集成，也说明团队开始把关注点从模型演示转向权限、数据边界和应用流程。",
  items: [
    {
      sourceTitle: "OpenAI 发布企业级代理",
      editorialTitle: "OpenAI 将企业级代理推向知识库和流程自动化",
      description: "OpenAI 将企业级代理能力扩展到内部知识库和业务流程场景，重点不是单一聊天入口，而是让代理能够在权限边界内完成检索、任务拆解和后续动作编排，适合已有工作流的企业团队评估。",
      keyPoints: [
        "新能力围绕企业知识库、权限控制和任务编排展开，目标是减少代理在真实业务流程中的接入成本。",
        "对开发者来说，更新更像一组可嵌入既有系统的代理能力，而不是面向消费者的独立聊天产品。",
        "来源没有给出完整性能指标和客户案例，因此落地效果仍需要结合试点反馈继续判断。",
      ],
      impact: "这类更新会把企业采用 AI 的问题从模型选择推进到权限、数据边界和流程集成，技术团队需要更早评估治理成本。",
      sourceName: "OpenAI Blog",
      url: "https://example.com/openai-agent",
    },
  ],
  trends: [
    {
      title: "企业代理从演示走向流程集成",
      desc: "多个更新都围绕权限、知识库和任务编排展开，说明代理产品正在从独立聊天入口进入企业已有系统。",
      evidenceTitles: ["OpenAI 将企业级代理推向知识库和流程自动化"],
    },
  ],
  warnings: [],
}

const aiModel: AiModelOption = {
  id: "model-1",
  name: "日报模型",
  description: "AI 日报生成模型",
  provider: "openai-compatible",
  baseUrl: "https://models.example.com/v1",
  requestPath: "/chat/completions",
  model: "daily-editor",
  apiKey: "secret",
  apiKeyEnv: "DASHSCOPE_API_KEY",
  baseUrlEnv: "DASHSCOPE_BASE_URL",
  modelEnv: "DASHSCOPE_MODEL",
  capabilities: ["post-summary"],
  defaultFor: ["post-summary"],
  source: "environment",
  editable: false,
  deletable: false,
  enabled: true,
  status: "ready",
  hasApiKey: true,
}

describe("daily AI news editorial composer", () => {
  test("builds a prompt with concrete density and anti-repetition rules", () => {
    const prompt = buildDailyAiNewsEditorialPrompt({
      date: new Date("2026-05-13T08:00:00Z"),
      candidates: [candidate()],
      factCards: [factCard()],
    })

    expect(prompt).toContain("日级主编稿")
    expect(prompt).toContain("description 写 120-220 个中文字符")
    expect(prompt).toContain("keyPoints 写 3-5 条")
    expect(prompt).toContain("禁止把 description 的同一句话复制到 keyPoints")
    expect(prompt).toContain("sourceTitle: OpenAI 发布企业级代理")
    expect(prompt).toContain("factSummary: OpenAI 发布企业代理更新")
  })

  test("parses substantive editorial JSON and rejects short repetitive drafts", () => {
    expect(parseDailyAiNewsEditorialBrief(JSON.stringify(validBrief))).toMatchObject({
      intro: expect.stringContaining("开发者工具"),
      items: [expect.objectContaining({ editorialTitle: "OpenAI 将企业级代理推向知识库和流程自动化" })],
      trends: [expect.objectContaining({ title: "企业代理从演示走向流程集成" })],
    })

    expect(parseDailyAiNewsEditorialBrief(JSON.stringify({
      intro: "今日 AI 有一些更新。",
      items: [
        {
          sourceTitle: "OpenAI 发布企业级代理",
          editorialTitle: "OpenAI 企业代理动态",
          description: "OpenAI 发布企业级代理。",
          keyPoints: ["OpenAI 发布企业级代理。", "OpenAI 发布企业级代理。", "OpenAI 发布企业级代理。"],
          sourceName: "OpenAI Blog",
          url: "https://example.com/openai-agent",
        },
      ],
      trends: [],
    }))).toBeNull()
  })

  test("requests an editorial brief and returns null on invalid model output", async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(validBrief) } }] }),
    })

    const result = await generateDailyAiNewsEditorialBrief({
      date: new Date("2026-05-13T08:00:00Z"),
      candidates: [candidate()],
      factCards: [factCard()],
      aiModel,
      fetchImpl,
    })

    expect(fetchImpl).toHaveBeenCalledWith("https://models.example.com/v1/chat/completions", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ Authorization: "Bearer secret" }),
    }))
    expect(JSON.parse(String(fetchImpl.mock.calls[0]?.[1]?.body))).toMatchObject({
      model: "daily-editor",
      temperature: 0.25,
      max_tokens: 5200,
    })
    expect(result?.items[0]?.keyPoints).toHaveLength(3)

    fetchImpl.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "{\"intro\":\"太短\"}" } }] }),
    })

    await expect(generateDailyAiNewsEditorialBrief({
      date: new Date("2026-05-13T08:00:00Z"),
      candidates: [candidate()],
      factCards: [factCard()],
      aiModel,
      fetchImpl,
    })).resolves.toBeNull()

    fetchImpl.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(validBrief) } }] }),
    })

    await expect(generateDailyAiNewsEditorialBrief({
      date: new Date("2026-05-13T08:00:00Z"),
      candidates: [
        candidate({ id: "candidate-1", title: "OpenAI 发布企业级代理", url: "https://example.com/openai-agent" }),
        candidate({ id: "candidate-2", title: "Recursive 获得融资", url: "https://example.com/recursive" }),
        candidate({ id: "candidate-3", title: "Poppy 推出 AI 助手", url: "https://example.com/poppy" }),
      ],
      factCards: [factCard()],
      aiModel,
      fetchImpl,
    })).resolves.toBeNull()
  })
})
