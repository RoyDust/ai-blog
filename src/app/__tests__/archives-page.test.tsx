import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    post: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "p2",
          title: "New Post",
          slug: "new-post",
          createdAt: new Date("2026-03-01T08:00:00Z"),
          excerpt: "latest",
          category: { name: "前端", slug: "frontend" },
        },
        {
          id: "p1",
          title: "Old Post",
          slug: "old-post",
          createdAt: new Date("2025-12-01T08:00:00Z"),
          excerpt: "older",
          category: { name: "后端", slug: "backend" },
        },
      ]),
    },
  },
}));

describe("archives page", () => {
  test("renders timeline with latest posts first", async () => {
    const { default: ArchivesPage } = await import("@/app/(public)/archives/page");
    const ui = await ArchivesPage();

    const { container } = render(ui as React.ReactElement);

    expect(screen.getByRole("heading", { level: 1, name: "文章归档" })).toBeInTheDocument();
    expect(screen.getByText("归档")).toHaveClass("ed-eyebrow");
    expect(container.querySelector(".reader-banner")).toBeNull();
    expect(container.querySelector(".reader-feed-card")).toBeNull();
    // 原来的两个按钮改成右侧文字链接
    expect(screen.getByRole("link", { name: "浏览全部文章" })).toHaveAttribute("href", "/posts");
    expect(screen.getByRole("link", { name: "查看分类专题" })).toHaveAttribute("href", "/categories");
    expect(screen.getByText("2 篇文章 · 2 个年份")).toBeInTheDocument();
    // 按年分组：区块标题写年份 + 篇数
    expect(screen.getByRole("heading", { name: "2026 1" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "2025 1" })).toBeInTheDocument();
    // 每条：等宽 MM-DD + 标题 + 摘要 + 分类小字
    const rows = screen.getAllByTestId("archive-row");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("03-01");
    expect(rows[0]).toHaveTextContent("latest");
    expect(rows[0].querySelector('a[href="/categories/frontend"]')).toHaveTextContent("前端");

    const links = container.querySelectorAll('a[href^="/posts/"]');
    expect(links[0]).toHaveTextContent("New Post");
    expect(links[1]).toHaveTextContent("Old Post");
  });

  test("shows an empty state with a way back home", async () => {
    const { prisma } = await import("@/lib/prisma");
    vi.mocked(prisma.post.findMany).mockResolvedValueOnce([] as never);

    const { default: ArchivesPage } = await import("@/app/(public)/archives/page");
    const ui = await ArchivesPage();

    render(ui as React.ReactElement);

    expect(screen.getByText("暂无已发布文章")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "回到首页" })).toHaveAttribute("href", "/");
    expect(screen.getByText("0 篇文章 · 0 个年份")).toBeInTheDocument();
  });
});
