import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const findMany = vi.fn();
const findFirst = vi.fn();

vi.mock("next/image", () => ({
  default: (props: React.ComponentProps<"img"> & { fill?: boolean; quality?: number }) => {
    void props;
    return null;
  },
}));

vi.mock("@/lib/blog-settings", () => ({
  getBlogSettings: () => Promise.resolve({ siteUrl: "https://blog.example" }),
}));

vi.mock("@/lib/seo", () => ({
  buildPageMetadata: (input: unknown) => input,
  buildBreadcrumbJsonLd: (items: Array<{ name: string; path: string }>, options: { siteUrl?: string } = {}) => ({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${options.siteUrl}${item.path}`,
    })),
  }),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    series: {
      findMany,
      findFirst,
    },
  },
}));

const post = {
  id: "p1",
  title: "First Post",
  slug: "first-post",
  excerpt: "Read first",
  coverImage: null,
  readingTimeMinutes: 6,
  createdAt: new Date("2026-03-01T00:00:00.000Z"),
  author: { id: "u1", name: "Ada", image: null },
  category: { id: "c1", name: "Engineering", slug: "engineering" },
  tags: [{ id: "t1", name: "Next", slug: "next" }],
  _count: { comments: 1, likes: 2 },
  viewCount: 10,
};

describe("series public pages", () => {
  beforeEach(() => {
    findMany.mockReset();
    findFirst.mockReset();
  });

  test("/series renders only public series returned by the published-post query", async () => {
    findMany.mockResolvedValueOnce([
      { id: "s1", title: "工程系列", slug: "engineering", description: "连续阅读", coverImage: null, _count: { posts: 1 } },
    ]);

    const { default: SeriesPage } = await import("../page");
    const ui = await SeriesPage();

    const { container } = render(ui as React.ReactElement);

    expect(screen.getByRole("heading", { level: 1, name: "全部系列" })).toBeInTheDocument();
    expect(screen.getByText("1 个系列 · 1 篇文章")).toBeInTheDocument();
    // 系列目录的次级链接写「全部文章 →」，不放「在列表页中筛选」
    expect(screen.getByRole("link", { name: "全部文章" })).toHaveAttribute("href", "/posts");
    expect(screen.queryByRole("link", { name: "在列表页中筛选" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "工程系列" })).toHaveAttribute("href", "/series/engineering");
    // 状态写在 meta 开头，不用 chip；没有「进入系列 →」
    expect(screen.getByText("连载中")).toBeInTheDocument();
    expect(container.querySelector(".reader-chip")).toBeNull();
    expect(screen.queryByRole("link", { name: /进入系列/ })).not.toBeInTheDocument();
    expect(container.querySelector(".onload-animation")).toBeNull();
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        deletedAt: null,
        posts: {
          some: {
            deletedAt: null,
            published: true,
          },
        },
      },
    }));
  });

  test("/series marks daily series as 每日更新", async () => {
    findMany.mockResolvedValueOnce([
      { id: "s2", title: "AI 日报", slug: "ai-daily", description: null, coverImage: null, _count: { posts: 3 } },
    ]);

    const { default: SeriesPage } = await import("../page");
    render((await SeriesPage()) as React.ReactElement);

    expect(screen.getByText("每日更新")).toBeInTheDocument();
  });

  test("/series/[slug] renders published posts and filters unpublished or deleted posts in the query", async () => {
    findFirst.mockResolvedValueOnce({
      id: "s1",
      title: "工程系列",
      slug: "engineering",
      description: "连续阅读",
      _count: { posts: 1 },
      posts: [post],
    });

    const { default: SeriesDetailPage } = await import("../[slug]/page");
    const ui = await SeriesDetailPage({ params: Promise.resolve({ slug: "engineering" }) });

    const { container } = render(ui as React.ReactElement);

    expect(screen.getByRole("heading", { level: 1, name: "工程系列" })).toBeInTheDocument();
    expect(screen.getByText("连载中 · 1 篇 · 预计 6 分钟")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "全部系列" })).toHaveAttribute("href", "/series");
    expect(screen.getByRole("heading", { name: "文章 1" })).toBeInTheDocument();
    expect(screen.getByText("按阅读顺序")).toBeInTheDocument();
    // 左列两位序号，日期移进 meta
    expect(container.querySelector(".ed-row__index")).toHaveTextContent("01");
    expect(container).toHaveTextContent("2026-03-01");
    expect(screen.getAllByRole("link", { name: "First Post" })[0]).toHaveAttribute("href", "/posts/first-post");
    expect(container.querySelector(".onload-animation")).toBeNull();
    expect(JSON.parse(container.querySelector('script[type="application/ld+json"]')?.textContent ?? "{}")).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: [
        { name: "首页", item: "https://blog.example/" },
        { name: "系列", item: "https://blog.example/series" },
        { name: "工程系列", item: "https://blog.example/series/engineering" },
      ],
    });
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        slug: "engineering",
        deletedAt: null,
        posts: { some: { deletedAt: null, published: true } },
      }),
      include: expect.objectContaining({
        posts: expect.objectContaining({
          where: { deletedAt: null, published: true },
          orderBy: [{ seriesOrder: "asc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
        }),
      }),
    }));
  });
});
