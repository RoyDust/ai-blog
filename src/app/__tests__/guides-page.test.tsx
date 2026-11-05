import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const listPublicTopicGuides = vi.fn();
const getPublicTopicGuideBySlug = vi.fn();
const notFound = vi.fn();

vi.mock("next/image", () => ({
  default: (props: React.ComponentProps<"img"> & { fill?: boolean; quality?: number }) => {
    void props;
    return null;
  },
}));

vi.mock("next/navigation", () => ({
  notFound,
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

vi.mock("@/lib/topic-guides", () => ({
  listPublicTopicGuides,
  getPublicTopicGuideBySlug,
}));

const publicPost = {
  id: "p1",
  title: "First Post",
  slug: "first-post",
  generatedByAiNews: false,
  excerpt: "Read first",
  coverImage: null,
  featured: false,
  createdAt: new Date("2026-03-01T00:00:00.000Z"),
  readingTimeMinutes: 3,
  author: { id: "u1", name: "Ada", image: null },
  category: { id: "c1", name: "Engineering", slug: "engineering" },
  tags: [{ id: "t1", name: "Next", slug: "next" }],
  _count: { comments: 1, likes: 2 },
  viewCount: 10,
};

describe("guides public pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("/guides lists published guides returned by the public service", async () => {
    listPublicTopicGuides.mockResolvedValueOnce([
      {
        id: "guide-1",
        title: "工程入门",
        slug: "engineering-start",
        description: "从这里开始",
        createdAt: new Date("2026-06-01T00:00:00Z"),
        posts: [{ id: "row-1" }, { id: "row-2" }],
      },
    ]);

    const { default: GuidesPage } = await import("@/app/(public)/guides/page");
    const ui = await GuidesPage();

    const { container } = render(ui as React.ReactElement);

    expect(screen.getByRole("heading", { level: 1, name: "专题导读" })).toBeInTheDocument();
    expect(screen.getByText("专题")).toHaveClass("ed-eyebrow");
    expect(screen.getByText("1 个专题 · 2 篇精选文章")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "工程入门" })).toHaveAttribute("href", "/guides/engineering-start");
    expect(screen.getByText("2 篇 · 2026-06-01")).toBeInTheDocument();
    expect(screen.getByText("从这里开始")).toHaveClass("line-clamp-3");
    // 去掉卡片、「N 篇」chip 和「进入导读」链接
    expect(container.querySelector(".reader-feed-card, .reader-chip")).toBeNull();
    expect(screen.queryByRole("link", { name: "进入导读" })).not.toBeInTheDocument();
    expect(listPublicTopicGuides).toHaveBeenCalled();
  });

  test("/guides/[slug] renders ordered posts and guide notes", async () => {
    getPublicTopicGuideBySlug.mockResolvedValueOnce({
      id: "guide-1",
      title: "工程入门",
      slug: "engineering-start",
      description: "从入口到进阶",
      posts: [
        { id: "row-1", order: 1, note: "先读这一篇", post: publicPost },
      ],
    });

    const { default: GuideDetailPage } = await import("@/app/(public)/guides/[slug]/page");
    const ui = await GuideDetailPage({ params: Promise.resolve({ slug: "engineering-start" }) });
    const { container } = render(ui as React.ReactElement);

    expect(screen.getByRole("heading", { level: 1, name: "工程入门" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "全部专题" })).toHaveAttribute("href", "/guides");
    expect(screen.getByRole("heading", { name: "阅读顺序 1" })).toBeInTheDocument();
    // 编者导读：正文色小字 + 左侧 2px 竖线，不再是圆角面板
    expect(screen.getByText("先读这一篇")).toHaveClass("border-l-2");
    expect(screen.getByText("先读这一篇")).not.toHaveClass("reader-panel");
    // 列表行左列两位序号，日期并入 meta
    expect(container.querySelector(".ed-row__index")).toHaveTextContent("01");
    expect(container).toHaveTextContent("2026-03-01");
    expect(screen.getAllByRole("link", { name: "First Post" })[0]).toHaveAttribute("href", "/posts/first-post");
    expect(JSON.parse(container.querySelector('script[type="application/ld+json"]')?.textContent ?? "{}")).toMatchObject({
      "@type": "BreadcrumbList",
      itemListElement: [
        { name: "首页", item: "https://blog.example/" },
        { name: "专题导读", item: "https://blog.example/guides" },
        { name: "工程入门", item: "https://blog.example/guides/engineering-start" },
      ],
    });
  });

  test("/guides shows empty and load-error states without containers", async () => {
    const { default: GuidesPage } = await import("@/app/(public)/guides/page");

    listPublicTopicGuides.mockResolvedValueOnce([]);
    const { unmount } = render((await GuidesPage()) as React.ReactElement);
    expect(screen.getByText("当前还没有已发布的专题导读")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "全部系列" })).toHaveAttribute("href", "/series");
    unmount();

    vi.spyOn(console, "error").mockImplementationOnce(() => {});
    listPublicTopicGuides.mockRejectedValueOnce(new Error("db down"));
    render((await GuidesPage()) as React.ReactElement);
    expect(screen.getByRole("alert")).toHaveTextContent("专题导读加载失败，请稍后重试。");
    expect(screen.getByRole("link", { name: "重试" })).toHaveClass("ed-btn-outline");
  });

  test("missing guide returns notFound", async () => {
    getPublicTopicGuideBySlug.mockResolvedValueOnce(null);

    const { default: GuideDetailPage } = await import("@/app/(public)/guides/[slug]/page");
    await GuideDetailPage({ params: Promise.resolve({ slug: "missing" }) });

    expect(notFound).toHaveBeenCalled();
  });
});
