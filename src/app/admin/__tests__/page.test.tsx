import { render, screen, within } from "@testing-library/react";
import React from "react";
import { describe, expect, test, vi } from "vitest";

const { postFindManyMock, commentCountMock, commentFindManyMock, getPublicAiModelOptionsMock } = vi.hoisted(() => {
  const draftQueuePosts = [
    {
      id: "post-draft-1",
      title: "Queued Draft",
      slug: "queued-draft",
      coverImage: "https://example.com/draft.jpg",
      updatedAt: new Date("2026-04-04T00:00:00Z"),
      createdAt: new Date("2026-04-03T00:00:00Z"),
    },
  ];

  const popularPosts = [
    {
      id: "post-popular-1",
      title: "Most Viewed Post",
      slug: "most-viewed-post",
      coverImage: "https://example.com/popular-1.jpg",
      viewCount: 120,
      publishedAt: new Date("2026-04-05T00:00:00Z"),
    },
    {
      id: "post-popular-2",
      title: "Second Viewed Post",
      slug: "second-viewed-post",
      coverImage: "https://example.com/popular-2.jpg",
      viewCount: 42,
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
    postFindManyMock: vi.fn(({ where, orderBy }) => {
      if (where?.published === false) {
        return Promise.resolve(draftQueuePosts);
      }

      if (where?.published === true && orderBy?.viewCount === "desc") {
        return Promise.resolve(popularPosts);
      }

      return Promise.resolve([]);
    }),
    commentCountMock: vi.fn().mockResolvedValue(4),
    commentFindManyMock: vi.fn().mockResolvedValue(pendingQueueComments),
    getPublicAiModelOptionsMock: vi.fn().mockResolvedValue(aiModels),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findMany: postFindManyMock,
    },
    comment: {
      count: commentCountMock,
      findMany: commentFindManyMock,
    },
  },
}));

vi.mock("@/lib/ai-models", () => ({
  getPublicAiModelOptions: getPublicAiModelOptionsMock,
}));

describe("admin overview", () => {
  test("renders the lightweight blog dashboard with real queues and AI model panel", async () => {
    const { default: AdminPage } = await import("../page");
    const ui = await AdminPage();

    render(ui as React.ReactElement);

    expect(screen.getByRole("heading", { name: "访问趋势" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "最近草稿" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "待审评论" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "热门文章" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "AI 模型清单" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "博客后台总览" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "发布清单" })).not.toBeInTheDocument();

    expect(screen.getByText("静态示意")).toBeInTheDocument();
    expect(screen.getByText("7 天")).toBeInTheDocument();
    expect(screen.getByText("05-15")).toBeInTheDocument();

    expect(screen.getByText("Queued Draft")).toBeInTheDocument();
    const recentDraftsPanel = screen.getByRole("heading", { name: "最近草稿" }).closest("section");
    expect(recentDraftsPanel).not.toBeNull();
    expect(within(recentDraftsPanel as HTMLElement).getByRole("img", { name: "Queued Draft 封面" })).toHaveAttribute("src", "https://example.com/draft.jpg");
    expect(screen.getByRole("link", { name: "继续编辑" })).toHaveAttribute("href", "/admin/posts/post-draft-1/edit");
    expect(screen.getByText("待处理评论内容")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "批准" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "垃圾" })).toBeInTheDocument();

    const popularPanel = screen.getByRole("heading", { name: "热门文章" }).closest("section");
    expect(popularPanel).not.toBeNull();
    expect(within(popularPanel as HTMLElement).getByText("Most Viewed Post")).toBeInTheDocument();
    expect(within(popularPanel as HTMLElement).getByText("Second Viewed Post")).toBeInTheDocument();
    expect(within(popularPanel as HTMLElement).getByText("120 浏览")).toBeInTheDocument();

    const aiModelPanel = screen.getByRole("heading", { name: "AI 模型清单" }).closest("section");
    expect(aiModelPanel).not.toBeNull();
    expect(within(aiModelPanel as HTMLElement).getByText("文章摘要生成")).toBeInTheDocument();
    expect(within(aiModelPanel as HTMLElement).getByText("summary-model")).toBeInTheDocument();
    expect(within(aiModelPanel as HTMLElement).getByText("当前首选")).toBeInTheDocument();
    expect(within(aiModelPanel as HTMLElement).getByText("可用")).toBeInTheDocument();
    expect(within(aiModelPanel as HTMLElement).getByText("环境变量")).toBeInTheDocument();
    expect(within(aiModelPanel as HTMLElement).getByText("备用摘要模型")).toBeInTheDocument();
    expect(within(aiModelPanel as HTMLElement).getByText("缺少密钥")).toBeInTheDocument();
    expect(within(aiModelPanel as HTMLElement).getByText("AI_BACKUP_API_KEY")).toBeInTheDocument();
    expect(within(aiModelPanel as HTMLElement).getByRole("link", { name: "管理模型" })).toHaveAttribute("href", "/admin/ai/models");

    expect(commentCountMock).toHaveBeenCalledWith({
      where: { deletedAt: null, status: "PENDING" },
    });
    expect(postFindManyMock).toHaveBeenCalledWith({
      where: { deletedAt: null, published: false },
      select: { id: true, title: true, slug: true, coverImage: true, updatedAt: true, createdAt: true },
      orderBy: { updatedAt: "desc" },
      take: 4,
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
    expect(postFindManyMock).toHaveBeenCalledWith({
      where: { deletedAt: null, published: true },
      select: { id: true, title: true, slug: true, coverImage: true, viewCount: true, publishedAt: true },
      orderBy: { viewCount: "desc" },
      take: 5,
    });
    expect(getPublicAiModelOptionsMock).toHaveBeenCalledTimes(1);
  });
});
