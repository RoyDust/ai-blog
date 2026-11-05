import React from "react";
import { render } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { PostCard } from "@/components/blog/PostCard";

vi.mock("next/image", () => ({
  default: (props: React.ComponentProps<"img"> & { blurDataURL?: string; fill?: boolean; placeholder?: string; quality?: number }) => {
    const { blurDataURL: _blurDataURL, fill: _fill, placeholder: _placeholder, quality: _quality, ...imageProps } = props;
    void _blurDataURL;
    void _fill;
    void _placeholder;
    void _quality;
    return React.createElement("img", { ...imageProps, alt: imageProps.alt ?? "" });
  },
}));

const post = {
  id: "1",
  title: "Test title",
  slug: "test-title",
  excerpt: "Excerpt",
  coverImage: null,
  createdAt: new Date().toISOString(),
  author: { id: "u1", name: "Tester", image: null },
  category: { name: "Tech", slug: "tech" },
  tags: [{ name: "next", slug: "next" }],
  _count: { comments: 1, likes: 2 },
};

test("post card uses the editorial list row shell", () => {
  const { container } = render(<PostCard post={post} />);
  const row = container.firstElementChild;

  expect(row?.tagName).toBe("ARTICLE");
  expect(row).toHaveClass("ed-row");
  expect(row).toHaveAttribute("data-testid", "post-list-row");
  expect(row?.className).not.toContain("reader-feed-card");
  expect(row?.className).not.toContain("reader-card");
});

test("post card renders a 4:3 cover thumb, a single title link, and clamps copy", () => {
  const { container } = render(<PostCard post={{ ...post, coverImage: "http://project.roydust.top/demo.png" }} />);

  const article = container.querySelector("article");
  const title = container.querySelector(".ed-row__title");
  const excerpt = container.querySelector("p.ed-row__excerpt");
  const thumb = container.querySelector(".ed-row__thumb");

  expect(article?.className).not.toContain("md:grid-cols-[12rem_minmax(0,1fr)_2rem]");
  expect(title).toHaveClass("line-clamp-2");
  expect(excerpt).toHaveClass("line-clamp-2");
  expect(thumb).toBeInTheDocument();
  // 封面是装饰：alt 为空、对读屏隐藏，不再包一层独立链接
  expect(thumb?.querySelector("img")).toHaveAttribute("alt", "");
  expect(thumb?.querySelector("img")).toHaveAttribute("aria-hidden", "true");
  expect(thumb?.querySelector("a")).toBeNull();
  // 旧版封面链接 / 尾部 CTA 箭头已移除
  expect(container.querySelector('a[aria-label="阅读 Test title"]')).toBeNull();
  expect(container.querySelector('a[aria-label="继续阅读 Test title"]')).toBeNull();
  expect(container.querySelector(".theme-media")).toBeNull();
  expect(container.querySelector(".reader-card-action")).toBeNull();
  expect(container.querySelectorAll('a[href="/posts/test-title"]')).toHaveLength(1);
});
