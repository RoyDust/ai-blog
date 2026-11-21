import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

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
      findFirst,
    },
  },
}));

describe("/series/[slug] narrow post projection", () => {
  beforeEach(() => {
    findFirst.mockReset();
  });

  test("queries series posts with an explicit select omitting Post.content and filtering soft-deleted relations", async () => {
    findFirst.mockResolvedValueOnce({
      id: "s1",
      title: "架构演进系列",
      slug: "architecture-series",
      description: "按顺序阅读",
      _count: { posts: 1 },
      posts: [
        {
          id: "p1",
          title: "第一篇：边界划分",
          slug: "part-1-boundaries",
          excerpt: "介绍模块边界与查询裁剪。",
          coverImage: "https://cdn.example/cover.png",
          featured: true,
          generatedByAiNews: false,
          createdAt: new Date("2026-03-10T00:00:00.000Z"),
          publishedAt: new Date("2026-03-10T00:00:00.000Z"),
          seriesOrder: 1,
          readingTimeMinutes: 8,
          viewCount: 42,
          author: { id: "u1", name: "Ada", image: null },
          category: { id: "c1", name: "架构", slug: "architecture" },
          tags: [{ id: "t1", name: "Prisma", slug: "prisma" }],
          _count: { comments: 3, likes: 7 },
        },
      ],
    });

    const { default: SeriesDetailPage } = await import("../page");
    const ui = await SeriesDetailPage({ params: Promise.resolve({ slug: "architecture-series" }) });
    render(ui as React.ReactElement);

    expect(screen.getByRole("heading", { level: 1, name: "架构演进系列" })).toBeInTheDocument();
    expect(screen.getByText("连载中 · 1 篇 · 预计 8 分钟")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "第一篇：边界划分" })).toHaveAttribute("href", "/posts/part-1-boundaries");
    expect(screen.getByText("介绍模块边界与查询裁剪。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "架构" })).toHaveAttribute("href", "/categories/architecture");
    expect(screen.getByRole("link", { name: "#Prisma" })).toHaveAttribute("href", "/tags/prisma");

    const queryArgs = findFirst.mock.calls[0]?.[0];
    const postsQuery = queryArgs?.include?.posts;
    expect(postsQuery?.include).toBeUndefined();
    expect(postsQuery?.select).toBeDefined();
    expect(postsQuery?.select).not.toHaveProperty("content");
    expect(postsQuery?.select).toMatchObject({
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      coverImage: true,
      featured: true,
      createdAt: true,
      readingTimeMinutes: true,
      viewCount: true,
      author: { select: { id: true, name: true, image: true } },
      category: { where: { deletedAt: null }, select: { id: true, name: true, slug: true } },
      tags: { where: { deletedAt: null }, select: { id: true, name: true, slug: true } },
    });
  });
});
