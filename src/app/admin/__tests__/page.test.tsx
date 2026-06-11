import { render, screen, within } from "@testing-library/react";
import React from "react";
import { describe, expect, test, vi } from "vitest";

const { postFindManyMock, commentFindManyMock, findPopularPostVisitsInRangeMock, getAdminTodoCountsMock, getDashboardStatsWithComparisonMock, getPublicAiModelOptionsMock } = vi.hoisted(() => {
  const draftQueuePosts = [
    {
      id: "post-draft-1",
      title: "Queued Draft",
      slug: "queued-draft",
      excerpt: "这是第一篇草稿的内容摘要，用于后台快速查看。",
      content: "# Queued Draft\n\n这是第一篇草稿正文。",
      updatedAt: new Date("2026-04-04T00:00:00Z"),
      createdAt: new Date("2026-04-03T00:00:00Z"),
    },
    {
      id: "post-draft-2",
      title: "Second Draft",
      slug: "second-draft",
      excerpt: null,
      content: "# Second Draft\n\n这是第二篇草稿正文内容，来自正文预览。",
      updatedAt: new Date("2026-04-03T00:00:00Z"),
      createdAt: new Date("2026-04-02T00:00:00Z"),
    },
    {
      id: "post-draft-3",
      title: "Third Draft",
      slug: "third-draft",
      excerpt: "第三篇草稿摘要。",
      content: "正文备用。",
      updatedAt: new Date("2026-04-02T00:00:00Z"),
      createdAt: new Date("2026-04-01T00:00:00Z"),
    },
  ];

  const popularPosts = [
    {
      id: "post-popular-1",
      title: "Most Viewed Post",
      slug: "most-viewed-post",
      coverImage: "https://example.com/popular-1.jpg",
      visitCount: 120,
      publishedAt: new Date("2026-04-05T00:00:00Z"),
    },
    {
      id: "post-popular-2",
      title: "Second Viewed Post",
      slug: "second-viewed-post",
      coverImage: "https://example.com/popular-2.jpg",
      visitCount: 42,
      publishedAt: new Date("2026-04-04T00:00:00Z"),
    },
  ];

  const pendingQueueComments = [
    {
      id: "comment-pending-1",
      content: "待处理评论内容",
      createdAt: new Date("2026-04-02T00:00:00Z"),
      author: null,
      authorLabel: "匿名访客",
      post: { title: "Most Viewed Post", slug: "most-viewed-post" },
    },
  ];

  const aiModels = [
    {
      id: "post-summary-openai-compatible",
      name: "文章摘要生成",
      description: "用于后台编辑器的一键中文摘要，当前走 OpenAI Chat Completions 兼容接口。",
      provider: "openai-compatible",
      baseUrl: "https://compat.example/v1",
      requestPath: "/chat/completions",
      model: "summary-model",
      apiKeyEnv: "AI_OPENAI_COMPAT_API_KEY",
      baseUrlEnv: "AI_OPENAI_COMPAT_BASE_URL",
      modelEnv: "AI_OPENAI_COMPAT_MODEL",
      capabilities: ["post-summary"],
      defaultFor: ["post-summary"],
      source: "environment",
      editable: false,
      deletable: false,
      enabled: true,
      status: "ready",
      hasApiKey: true,
      lastTestedAt: null,
      lastTestStatus: null,
      lastTestMessage: null,
    },
    {
      id: "backup-summary",
      name: "备用摘要模型",
      description: "用于摘要生成的备用数据库模型。",
      provider: "openai-compatible",
      baseUrl: "https://backup.example/v1",
      requestPath: "/chat/completions",
      model: "backup-summary-model",
      apiKeyEnv: "AI_BACKUP_API_KEY",
      baseUrlEnv: "database",
      modelEnv: "database",
      capabilities: ["post-summary"],
      defaultFor: [],
      source: "database",
      editable: true,
      deletable: true,
      enabled: true,
      status: "missing-api-key",
      hasApiKey: false,
      lastTestedAt: null,
      lastTestStatus: null,
      lastTestMessage: null,
    },
  ];

  return {
    postFindManyMock: vi.fn(({ where }) => {
      if (where?.published === false) {
        return Promise.resolve(draftQueuePosts);
      }

      return Promise.resolve([]);
    }),
    commentFindManyMock: vi.fn().mockResolvedValue(pendingQueueComments),
    findPopularPostVisitsInRangeMock: vi.fn().mockResolvedValue(popularPosts),
    getAdminTodoCountsMock: vi.fn().mockResolvedValue({
      pendingComments: 4,
      failedAiTasks: 2,
      staleDrafts: 3,
      pendingNewsletters: 1,
    }),
    getDashboardStatsWithComparisonMock: vi.fn().mockResolvedValue({
      current: {
        range: 7,
        visits: {
          range: 7,
          hasData: true,
          trend: [
            { date: "2026-05-10", label: "05-10", pv: 10, uv: 6 },
            { date: "2026-05-11", label: "05-11", pv: 14, uv: 8 },
          ],
          summary: { totalPv: 24, totalUv: 10, todayPv: 14, yesterdayPv: 10 },
        },
        reading: {
          range: 7,
          hasData: true,
          trend: [],
          summary: {
            totalEvents: 5,
            qualifiedEvents: 4,
            completedEvents: 3,
            totalDurationSeconds: 780,
            averageDurationSeconds: 156,
          },
        },
        engagement: {
          range: 7,
          hasData: true,
          trend: [
            { date: "2026-05-10", label: "05-10", comments: 1, likes: 2 },
            { date: "2026-05-11", label: "05-11", comments: 2, likes: 4 },
          ],
          summary: { comments: 3, likes: 6, total: 9 },
        },
      },
      previous: {
        range: 7,
        visits: { range: 7, hasData: false, trend: [], summary: { totalPv: 12, totalUv: 5, todayPv: 0, yesterdayPv: 0 } },
        reading: { range: 7, hasData: false, trend: [], summary: { totalEvents: 0, qualifiedEvents: 0, completedEvents: 0, totalDurationSeconds: 0, averageDurationSeconds: 0 } },
        engagement: { range: 7, hasData: false, trend: [], summary: { comments: 0, likes: 0, total: 0 } },
      },
      metrics: {
        publishedPosts: 6,
        readingMinutes: 13,
        engagementRate: 0.38,
        subscribers: 5,
      },
      previousMetrics: {
        publishedPosts: 2,
        readingMinutes: 5,
        engagementRate: 0.2,
        subscribers: 1,
      },
      deltas: {
        visits: 12,
        publishedPosts: 4,
        readingMinutes: 8,
        engagementRate: 0.18,
        subscribers: 4,
      },
    }),
    getPublicAiModelOptionsMock: vi.fn().mockResolvedValue(aiModels),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findMany: postFindManyMock,
    },
    comment: {
      findMany: commentFindManyMock,
    },

  },
}));

vi.mock("@/lib/ai-models", () => ({
  getPublicAiModelOptions: getPublicAiModelOptionsMock,
}));

vi.mock("@/lib/visit-log-repository", () => ({
  findPopularPostVisitsInRange: findPopularPostVisitsInRangeMock,
}));

vi.mock("@/lib/admin-stats", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/admin-stats")>();
  return {
    ...actual,
    getAdminTodoCounts: getAdminTodoCountsMock,
    getDashboardStatsWithComparison: getDashboardStatsWithComparisonMock,
  };
});

describe("admin overview", () => {
  test("renders the todo-first dashboard with health metrics and detail panels", async () => {
    const { default: AdminPage } = await import("../page");
    const ui = await AdminPage();

    render(ui as React.ReactElement);

    expect(screen.getByRole("heading", { name: "访问趋势" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "阅读统计" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "互动统计" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "最近草稿" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "待审评论" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "热门文章" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "AI 模型清单" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "博客后台总览" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "发布清单" })).not.toBeInTheDocument();

    expect(screen.getByRole("region", { name: "今日待办" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "待审评论 4 条，点击进入评论审核" })).toHaveAttribute("href", "/admin/comments");
    expect(screen.getByRole("link", { name: "失败 AI 任务 2 条，点击进入AI 任务中心" })).toHaveAttribute("href", "/admin/ai/tasks");
    expect(screen.getByRole("link", { name: "滞留草稿 3 条，点击进入文章工作台" })).toHaveAttribute("href", "/admin/posts");
    expect(screen.getByRole("link", { name: "待处理 Newsletter 1 条，点击进入Newsletter" })).toHaveAttribute("href", "/admin/newsletter");
    expect(screen.getByText("7 日发布数")).toBeInTheDocument();
    expect(screen.getByText("6 篇")).toBeInTheDocument();
    expect(screen.getByText("阅读时长")).toBeInTheDocument();
    expect(screen.getByText("互动率")).toBeInTheDocument();
    expect(screen.getByText("订阅净增")).toBeInTheDocument();
    expect(screen.getByText("较上期 +4 篇")).toBeInTheDocument();
    expect(screen.getByText("较上期 +18 个百分点")).toBeInTheDocument();

    expect(screen.getByText("真实统计")).toBeInTheDocument();
    expect(screen.getByText("7 天")).toBeInTheDocument();
    expect(screen.getByText("30 天")).toBeInTheDocument();
    expect(screen.getByText("区间 PV")).toBeInTheDocument();
    expect(screen.getByText("区间 UV")).toBeInTheDocument();
    expect(screen.getByText("有效阅读")).toBeInTheDocument();
    expect(screen.getByText("深度完成")).toBeInTheDocument();
    expect(screen.getAllByText("13 分钟")).toHaveLength(2);
    expect(screen.getByText("总互动")).toBeInTheDocument();
    expect(screen.getByText("评论")).toBeInTheDocument();
    expect(screen.getByText("点赞")).toBeInTheDocument();

    expect(screen.getByText("Queued Draft")).toBeInTheDocument();
    const recentDraftsPanel = screen.getByRole("heading", { name: "最近草稿" }).closest("section");
    expect(recentDraftsPanel).not.toBeNull();
    expect(within(recentDraftsPanel as HTMLElement).queryByRole("img", { name: /封面/ })).not.toBeInTheDocument();
    expect(within(recentDraftsPanel as HTMLElement).getByText("这是第一篇草稿的内容摘要，用于后台快速查看。"));
    expect(within(recentDraftsPanel as HTMLElement).getByText(/这是第二篇草稿正文内容/)).toBeInTheDocument();
    expect(within(recentDraftsPanel as HTMLElement).getByText("Third Draft")).toBeInTheDocument();
    expect(within(recentDraftsPanel as HTMLElement).getAllByRole("link", { name: "继续编辑" })[0]).toHaveAttribute("href", "/admin/posts/post-draft-1/edit");
    expect(screen.getByText("待处理评论内容")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "批准" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "垃圾" })).toBeInTheDocument();

    const popularPanel = screen.getByRole("heading", { name: "热门文章" }).closest("section");
    expect(popularPanel).not.toBeNull();
    expect(within(popularPanel as HTMLElement).getByText("Most Viewed Post")).toBeInTheDocument();
    expect(within(popularPanel as HTMLElement).getByText("Second Viewed Post")).toBeInTheDocument();
    expect(within(popularPanel as HTMLElement).getByText("近 7 天")).toBeInTheDocument();
    expect(within(popularPanel as HTMLElement).getByText("120 浏览")).toBeInTheDocument();

    expect(postFindManyMock).toHaveBeenCalledWith({
      where: { deletedAt: null, published: false },
      select: { id: true, title: true, slug: true, excerpt: true, content: true, updatedAt: true, createdAt: true },
      orderBy: { updatedAt: "desc" },
      take: 3,
    });
    expect(commentFindManyMock).toHaveBeenCalledWith({
      where: { deletedAt: null, status: "PENDING" },
      select: {
        id: true,
        content: true,
        createdAt: true,
        authorLabel: true,
        author: { select: { name: true, email: true } },
        post: { select: { title: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
    });
    expect(findPopularPostVisitsInRangeMock).toHaveBeenCalledWith(expect.any(Date), expect.any(Date), 5);
    expect(getAdminTodoCountsMock).toHaveBeenCalledTimes(1);
    expect(getDashboardStatsWithComparisonMock).toHaveBeenCalledWith(7);
    expect(getPublicAiModelOptionsMock).toHaveBeenCalledTimes(1);
  });
});
