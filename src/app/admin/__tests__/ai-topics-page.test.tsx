import { render, screen, within } from "@testing-library/react"
import React from "react"
import { describe, expect, test, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  listAiTopics: vi.fn(),
  requireAdminSession: vi.fn(),
  materializeTopicsFromRecentCandidates: vi.fn(),
  updateAiTopic: vi.fn(),
  createDraftFromTopic: vi.fn(),
}))

vi.mock("@/lib/ai-topic-radar", () => ({
  listAiTopics: mocks.listAiTopics,
  materializeTopicsFromRecentCandidates: mocks.materializeTopicsFromRecentCandidates,
  updateAiTopic: mocks.updateAiTopic,
  createDraftFromTopic: mocks.createDraftFromTopic,
}))

vi.mock("@/lib/api-auth", () => ({
  requireAdminSession: mocks.requireAdminSession,
}))

describe("admin AI topics page", () => {
  test("renders topic radar with status tabs, metrics, sources, and actions", async () => {
    mocks.listAiTopics.mockResolvedValueOnce([
      {
        id: "topic-1",
        title: "AI Agent",
        slug: "ai-agent",
        summary: "Agent SDK 进入工程化阶段",
        angle: "关注工作流工具。",
        status: "NEW",
        score: 8,
        heat: 28,
        tags: ["ai-agent", "agent"],
        riskFlags: ["vendor-claim"],
        sourceCount: 2,
        firstSeenAt: new Date("2026-06-01T00:00:00.000Z"),
        lastSeenAt: new Date("2026-06-02T00:00:00.000Z"),
        postId: null,
        createdAt: new Date("2026-06-02T00:00:00.000Z"),
        updatedAt: new Date("2026-06-02T00:00:00.000Z"),
        candidates: [
          {
            id: "link-1",
            topicId: "topic-1",
            candidateId: "candidate-1",
            relevance: 8,
            createdAt: new Date("2026-06-02T00:00:00.000Z"),
            candidate: {
              id: "candidate-1",
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
          },
        ],
      },
    ])

    const { default: AdminAiTopicsPage } = await import("../ai/topics/page")
    const ui = await AdminAiTopicsPage({ searchParams: Promise.resolve({ status: "NEW" }) })

    render(ui as React.ReactElement)

    expect(screen.getByRole("heading", { name: "AI 选题池 / 内容雷达" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "新选题" })).toHaveAttribute("href", "/admin/ai/topics?status=NEW")
    expect(screen.getByRole("link", { name: "观察中" })).toHaveAttribute("href", "/admin/ai/topics?status=WATCHING")
    expect(screen.getByRole("link", { name: "已规划" })).toHaveAttribute("href", "/admin/ai/topics?status=PLANNED")
    expect(screen.getByRole("link", { name: "已成稿" })).toHaveAttribute("href", "/admin/ai/topics?status=DRAFTED")
    expect(screen.getByRole("link", { name: "已归档" })).toHaveAttribute("href", "/admin/ai/topics?status=ARCHIVED")

    const topic = screen.getByRole("heading", { name: "AI Agent" }).closest("article")
    expect(topic).not.toBeNull()
    expect(within(topic as HTMLElement).getByText("热度 28")).toBeInTheDocument()
    expect(within(topic as HTMLElement).getByText("评分 8")).toBeInTheDocument()
    expect(within(topic as HTMLElement).getByText("来源 2")).toBeInTheDocument()
    expect(within(topic as HTMLElement).getByText("vendor-claim")).toBeInTheDocument()
    expect(within(topic as HTMLElement).getByRole("link", { name: "Agent SDK 发布" })).toHaveAttribute("href", "https://example.com/a")
    expect(within(topic as HTMLElement).getByRole("button", { name: "设为观察" })).toBeInTheDocument()
    expect(within(topic as HTMLElement).getByRole("button", { name: "加入规划" })).toBeInTheDocument()
    expect(within(topic as HTMLElement).getByRole("button", { name: "生成草稿" })).toBeInTheDocument()
    expect(within(topic as HTMLElement).getByRole("button", { name: "归档" })).toBeInTheDocument()
    expect(mocks.listAiTopics).toHaveBeenCalledWith({ status: "NEW" })
  })
})
