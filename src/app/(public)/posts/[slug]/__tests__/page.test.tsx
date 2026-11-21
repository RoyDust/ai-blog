import { fireEvent, render, within } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_BLOG_SETTINGS, type BlogSettings } from "@/lib/blog-settings";
import { renderArticleView } from "../page";

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a data-next-link="true" href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({
    alt = "",
    src,
  }: {
    alt?: string;
    src: string;
    fill?: boolean;
    unoptimized?: boolean;
    width?: number;
    height?: number;
  }) => React.createElement("img", { alt, src }),
}));

const mockSettings: BlogSettings = {
  ...DEFAULT_BLOG_SETTINGS,
  siteName: "Inkforge",
  siteDescription: "AI Engineering Blog",
  siteUrl: "https://inkforge.example",
  newsletter: {
    ...DEFAULT_BLOG_SETTINGS.newsletter,
    enabled: false,
    provider: "none",
  },
};

function buildPost(content: string) {
  return {
    id: "post-1",
    title: "数据请求与缓存工程实践",
    slug: "swr-engineering-guide",
    content,
    excerpt: "深入客户端请求状态与文章渲染体验。",
    seoDescription: null,
    coverImage: null,
    createdAt: new Date("2026-11-20T08:00:00.000Z"),
    updatedAt: new Date("2026-11-20T09:00:00.000Z"),
    publishedAt: new Date("2026-11-20T08:30:00.000Z"),
    published: false,
    viewCount: 128,
    readingTimeMinutes: 6,
    author: {
      id: "author-1",
      name: "Roy",
      image: null,
    },
    category: {
      name: "前端工程",
      slug: "frontend",
    },
    series: null,
    tags: [{ name: "SWR", slug: "swr" }],
    _count: {
      comments: 0,
      likes: 0,
    },
  };
}

describe("/posts/[slug] markdown TOC, inline heading anchors, and safe links", () => {
  beforeEach(() => {
    window.matchMedia = vi.fn((query: string) => ({
      matches: query.includes("prefers-reduced-motion"),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  test("excludes # comments inside backtick, tilde, and nested 4-backtick fenced code blocks from TOC", async () => {
    const markdown = [
      "# 数据请求与缓存工程实践",
      "",
      "## 环境准备",
      "",
      "```bash",
      "# 安装依赖",
      "pnpm add swr",
      "## 这也是 Shell 注释",
      "```",
      "",
      "~~~python",
      "# step 1: normalize payload",
      "### python comment",
      "print('ok')",
      "~~~",
      "",
      "````markdown",
      "```yaml",
      "# yaml nested comment",
      "```",
      "## 示例文档里的假标题",
      "````",
      "",
      "## 正式接入",
    ].join("\n");

    const { container } = render(
      renderArticleView({
        post: buildPost(markdown),
        isDraftPreview: true,
        relatedPosts: [],
        commentsPromise: null,
        settings: mockSettings,
      }),
    );

    const tocRail = container.querySelector('[data-testid="toc-rail"]') as HTMLElement;
    expect(tocRail).toBeTruthy();

    const tocLinks = await within(tocRail).findAllByRole("link");
    expect(tocLinks.map((link) => link.textContent)).toEqual(["环境准备", "正式接入"]);
  });

  test("aligns TOC hrefs 100% with rendered h2/h3 DOM ids for inline code, bold, links, images, escapes, and duplicates", async () => {
    const markdown = [
      "## 使用 `useSWR` 请求",
      "",
      "### 内嵌 ``a`b`` 与 **加粗** 及 [官方文档](https://swr.vercel.app \"SWR Docs\")",
      "",
      "## 架构图 ![SWR 图标](https://cdn.example.com/swr.png) 概览 ##",
      "",
      "## 常见问题 \\#1",
      "",
      "## `使用 useSWR 请求`",
      "",
      "## **常见问题 #1**",
    ].join("\n");

    const { container } = render(
      renderArticleView({
        post: buildPost(markdown),
        isDraftPreview: true,
        relatedPosts: [],
        commentsPromise: null,
        settings: mockSettings,
      }),
    );

    const prose = container.querySelector(".article-prose") as HTMLElement;
    const renderedHeadings = Array.from(prose.querySelectorAll("h2, h3"));
    renderedHeadings.forEach((headingElement, index) => {
      const top = index * 300;
      headingElement.getBoundingClientRect = () => ({
        top,
        bottom: top + 28,
        left: 0,
        right: 0,
        width: 600,
        height: 28,
        x: 0,
        y: top,
        toJSON: () => ({}),
      });
    });
    fireEvent.scroll(window);

    const renderedIds = renderedHeadings.map((el) => el.id);

    expect(renderedIds).toHaveLength(6);
    expect(new Set(renderedIds).size).toBe(6);

    const tocRail = container.querySelector('[data-testid="toc-rail"]') as HTMLElement;
    await within(tocRail).findByRole("link", { name: "内嵌 a`b 与 加粗 及 官方文档" });
    const tocTopAndActiveLinks = within(tocRail).getAllByRole("link");

    expect(tocTopAndActiveLinks.map((link) => link.textContent)).toEqual([
      "使用 useSWR 请求",
      "内嵌 a`b 与 加粗 及 官方文档",
      "架构图 SWR 图标 概览",
      "常见问题 #1",
      "使用 useSWR 请求",
      "常见问题 #1",
    ]);

    const tocTargetIds = tocTopAndActiveLinks.map((link) => link.getAttribute("href")?.replace(/^#/, ""));
    expect(tocTargetIds).toEqual(renderedIds);

    fireEvent.click(tocTopAndActiveLinks[0]);
    expect(renderedHeadings[0].scrollIntoView).toHaveBeenCalled();
  });

  test("renders safe external links, Next.js internal links, same-page/mailto anchors, and neutralizes dangerous schemes", () => {
    const markdown = [
      "请阅读 [SWR 外部文档](https://swr.vercel.app/docs) 或 [HTTP 参考](http://example.com) 及 [协议相对](//cdn.example.com/lib.js)。",
      "",
      "站内延伸阅读：[上一篇指南](/posts/nextjs-caching) 与 [分类目录](/categories/frontend?page=2)。",
      "",
      "页内跳转 [回到顶部章节](#环境准备) 或发送邮件至 [联系作者](mailto:hello@inkforge.example)。",
      "",
      "危险链接：[XSS 脚本](javascript:alert(1))、[VBScript](vbscript:msgbox(1))、[Data Payload](data:text/html,<script>alert(1)</script>)。",
    ].join("\n");

    const { container } = render(
      renderArticleView({
        post: buildPost(markdown),
        isDraftPreview: true,
        relatedPosts: [],
        commentsPromise: null,
        settings: mockSettings,
      }),
    );

    const prose = container.querySelector(".article-prose") as HTMLElement;

    const httpsLink = within(prose).getByRole("link", { name: "SWR 外部文档" });
    expect(httpsLink).toHaveAttribute("href", "https://swr.vercel.app/docs");
    expect(httpsLink).toHaveAttribute("target", "_blank");
    expect(httpsLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(httpsLink).not.toHaveAttribute("data-next-link");

    const httpLink = within(prose).getByRole("link", { name: "HTTP 参考" });
    expect(httpLink).toHaveAttribute("href", "http://example.com");
    expect(httpLink).toHaveAttribute("target", "_blank");
    expect(httpLink).toHaveAttribute("rel", "noopener noreferrer");

    const protocolRelativeLink = within(prose).getByRole("link", { name: "协议相对" });
    expect(protocolRelativeLink).toHaveAttribute("href", "//cdn.example.com/lib.js");
    expect(protocolRelativeLink).toHaveAttribute("target", "_blank");
    expect(protocolRelativeLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(protocolRelativeLink).not.toHaveAttribute("data-next-link");

    const internalPostLink = within(prose).getByRole("link", { name: "上一篇指南" });
    expect(internalPostLink).toHaveAttribute("href", "/posts/nextjs-caching");
    expect(internalPostLink).toHaveAttribute("data-next-link", "true");
    expect(internalPostLink).not.toHaveAttribute("target");
    expect(internalPostLink).not.toHaveAttribute("rel");

    const internalCategoryLink = within(prose).getByRole("link", { name: "分类目录" });
    expect(internalCategoryLink).toHaveAttribute("href", "/categories/frontend?page=2");
    expect(internalCategoryLink).toHaveAttribute("data-next-link", "true");
    expect(internalCategoryLink).not.toHaveAttribute("target");

    const hashLink = within(prose).getByRole("link", { name: "回到顶部章节" });
    expect(decodeURIComponent(hashLink.getAttribute("href") ?? "")).toBe("#环境准备");
    expect(hashLink).not.toHaveAttribute("target");
    expect(hashLink).not.toHaveAttribute("rel");
    expect(hashLink).not.toHaveAttribute("data-next-link");

    const mailtoLink = within(prose).getByRole("link", { name: "联系作者" });
    expect(mailtoLink).toHaveAttribute("href", "mailto:hello@inkforge.example");
    expect(mailtoLink).not.toHaveAttribute("target");
    expect(mailtoLink).not.toHaveAttribute("data-next-link");

    for (const label of ["XSS 脚本", "VBScript", "Data Payload"]) {
      const neutralized = within(prose).getByText(label);
      expect(neutralized.tagName).toBe("SPAN");
      expect(neutralized).not.toHaveAttribute("href");
      expect(neutralized.closest("a")).toBeNull();
    }
  });
});
