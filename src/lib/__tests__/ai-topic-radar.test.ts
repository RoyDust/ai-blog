import { beforeEach, describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  createAdminPost: vi.fn(),
  prisma: {
    $transaction: vi.fn(),
    aiNewsCandidate: {
      findMany: vi.fn(),
    },
    aiTopic: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    aiTopicCandidate: {
      upsert: vi.fn(),
    },
    post: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}))

vi.mock("@/lib/ai-authoring", () => ({
  createAdminPost: mocks.createAdminPost,
}))

describe("ai topic radar scoring", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.prisma))
  })

  test("groups candidates by normalized ai tags and title keywords", async () => {
    const { groupTopicCandidates } = await import("../ai-topic-radar")
    const groups = groupTopicCandidates([
      { id: "c1", title: "OpenAI releases agent SDK", aiTags: ["AI Agent"], aiScore: 8.5, publishedAt: new Date("2026-06-01") },
      { id: "c2", title: "New agent workflow tools", aiTags: ["ai agent"], aiScore: 7, publishedAt: new Date("2026-06-02") },
      { id: "c3", title: "PostgreSQL 18 beta", aiTags: ["Database"], aiScore: 6, publishedAt: new Date("2026-06-02") },
    ])

    expect(groups[0].tag).toBe("ai-agent")
    expect(groups[0].candidateIds).toEqual(["c1", "c2"])
    expect(groups[0].heat).toBeGreaterThan(groups[1].heat)
  })

  test("materializes topics from recent non-duplicate candidates", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-06-08T00:00:00.000Z"))
    mocks.prisma.aiNewsCandidate.findMany.mockResolvedValueOnce([
      {
        id: "c1",
        title: "OpenAI releases agent SDK",
        url: "https://example.com/a",
        summary: "SDK",
        aiSummary: "SDK",
        aiTags: ["AI Agent"],
        aiScore: 8,
        aiRiskFlags: ["vendor-claim"],
        publishedAt: new Date("2026-06-01T00:00:00.000Z"),
        createdAt: new Date("2026-06-01T01:00:00.000Z"),
      },
      {
        id: "c2",
        title: "Agent workflow tools",
        url: "https://example.com/b",
        summary: null,
        aiSummary: null,
        aiTags: ["ai agent"],
        aiScore: 7,
        aiRiskFlags: [],
        publishedAt: new Date("2026-06-02T00:00:00.000Z"),
        createdAt: new Date("2026-06-02T01:00:00.000Z"),
      },
    ])
    mocks.prisma.aiTopic.upsert.mockResolvedValueOnce({ id: "topic-1" })
    mocks.prisma.aiTopicCandidate.upsert.mockResolvedValue({ id: "link-1" })

    const { materializeTopicsFromRecentCandidates } = await import("../ai-topic-radar")
    const groups = await materializeTopicsFromRecentCandidates({ days: 7, excludeSelected: true })

    expect(mocks.prisma.aiNewsCandidate.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        duplicateOfId: null,
        selected: false,
      }),
    }))
    expect(mocks.prisma.aiTopic.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { slug: "ai-agent" },
      create: expect.objectContaining({
        tags: expect.arrayContaining(["ai-agent"]),
        riskFlags: ["vendor-claim"],
        sourceCount: 2,
      }),
      update: expect.objectContaining({
        sourceCount: 2,
      }),
    }))
    expect(mocks.prisma.aiTopicCandidate.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { topicId_candidateId: { topicId: "topic-1", candidateId: "c1" } },
    }))
    expect(mocks.prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(groups).toHaveLength(1)

    vi.useRealTimers()
  })

  test("creates an unpublished draft from a topic and keeps source links", async () => {
    mocks.prisma.aiTopic.findUnique.mockResolvedValueOnce({
      id: "topic-1",
      title: "AI Agent 工程化",
      summary: "从 Agent SDK 看工程化趋势",
      angle: "关注工具链落地。",
      candidates: [
        { id: "link-1", candidateId: "c1", topicId: "topic-1", relevance: 8 },
      ],
    })
    mocks.prisma.aiNewsCandidate.findMany.mockResolvedValueOnce([
      {
        id: "c1",
        title: "Agent SDK 发布",
        url: "https://example.com/a",
        canonicalUrl: "https://example.com/a",
        summary: "SDK news",
        aiSummary: "SDK summary",
        aiScore: 8,
        aiTags: ["AI Agent"],
        aiRiskFlags: [],
        publishedAt: new Date("2026-06-01T00:00:00.000Z"),
        sourceName: "Example",
        sourceType: "RSS",
      },
    ])
    mocks.prisma.post.findUnique.mockResolvedValueOnce(null)
    mocks.createAdminPost.mockResolvedValueOnce({ id: "post-1", title: "AI Agent 工程化", slug: "ai-agent-gong-cheng-hua", published: false })
    mocks.prisma.aiTopic.update.mockResolvedValueOnce({ id: "topic-1", status: "DRAFTED", postId: "post-1" })

    const { createDraftFromTopic } = await import("../ai-topic-radar")
    const post = await createDraftFromTopic("topic-1", "admin-1")

    expect(mocks.createAdminPost).toHaveBeenCalledWith({
      authorId: "admin-1",
      input: expect.objectContaining({
        title: "AI Agent 工程化",
        excerpt: "从 Agent SDK 看工程化趋势",
        published: false,
        generatedByAiNews: false,
        content: expect.stringContaining("[Agent SDK 发布](https://example.com/a)"),
      }),
    })
    expect(mocks.prisma.aiTopic.update).toHaveBeenCalledWith({
      where: { id: "topic-1" },
      data: { status: "DRAFTED", postId: "post-1" },
    })
    expect(post).toMatchObject({ id: "post-1", published: false })
  })
})
