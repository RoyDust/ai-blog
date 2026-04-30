import { render, screen, within } from "@testing-library/react";
import React from "react";
import { describe, expect, test, vi } from "vitest";

const { postFindManyMock, commentCountMock, commentFindManyMock } = vi.hoisted(() => {
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

describe("admin overview", () => {
  test("renders the lightweight blog dashboard with real queues and static panels", async () => {
    const { default: AdminPage } = await import("../page");
    const ui = await AdminPage();

    render(ui as React.ReactElement);

    expect(screen.getByRole("heading", { name: "访问趋势" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "最近草稿" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "待审评论" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "热门文章" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "发布清单" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "博客后台总览" })).not.toBeInTheDocument();

    expect(screen.getByText("静态示意")).toBeInTheDocument();
    expect(screen.getByText("7 天")).toBeInTheDocument();
    expect(screen.getByText("05-15")).toBeInTheDocument();
    expect(screen.getByText("设置 SEO 信息")).toBeInTheDocument();
    expect(screen.getByText("编辑清单")).toBeInTheDocument();

    expect(screen.getByText("Queued Draft")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "继续编辑" })).toHaveAttribute("href", "/admin/posts/post-draft-1/edit");
    expect(screen.getByText("待处理评论内容")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "批准" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "垃圾" })).toBeInTheDocument();

    const popularPanel = screen.getByRole("heading", { name: "热门文章" }).closest("section");
    expect(popularPanel).not.toBeNull();
    expect(within(popularPanel as HTMLElement).getByText("Most Viewed Post")).toBeInTheDocument();
    expect(within(popularPanel as HTMLElement).getByText("Second Viewed Post")).toBeInTheDocument();
    expect(within(popularPanel as HTMLElement).getByText("120 浏览")).toBeInTheDocument();

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
  });
});
