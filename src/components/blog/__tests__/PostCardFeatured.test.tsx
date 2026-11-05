import { render, screen } from "@testing-library/react";
import React from "react";
import { expect, test, vi } from "vitest";
import { PostCardFeatured } from "../PostCardFeatured";

vi.mock("next/image", () => ({
  default: (props: React.ComponentProps<"img"> & { fill?: boolean; priority?: boolean; blurDataURL?: string }) => {
    const { fill: _fill, priority: _priority, blurDataURL: _blurDataURL, ...imageProps } = props;
    void _fill;
    void _priority;
    void _blurDataURL;
    return React.createElement("img", { ...imageProps, alt: imageProps.alt ?? "" });
  },
}));

const leadStory = {
  id: "lead",
  title: "Lead story",
  slug: "lead-story",
  excerpt: "Longer summary for the lead story.",
  coverImage: "https://images.unsplash.com/photo-2",
  createdAt: "2026-03-01T00:00:00.000Z",
  readingTimeMinutes: 9,
  category: { name: "Engineering", slug: "engineering" },
  tags: [{ name: "Next", slug: "next" }],
};

test("featured card exposes editorial lead-story framing", () => {
  render(<PostCardFeatured post={leadStory} />);

  const article = screen.getByTestId("post-featured");
  expect(article.tagName).toBe("ARTICLE");
  expect(article.className).not.toContain("reader-feature-card");

  // 印章「精选」+ 分类名
  expect(screen.getByText("精选")).toHaveClass("ed-seal");
  expect(screen.queryByText("精选文章")).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Engineering" })).toHaveAttribute("href", "/categories/engineering");

  const heading = screen.getByRole("heading", { level: 2, name: "Lead story" });
  expect(heading).toHaveClass("ed-serif");
  expect(screen.getByRole("link", { name: "Lead story" })).toHaveAttribute("href", "/posts/lead-story");
  expect(screen.getByText("Longer summary for the lead story.")).toHaveClass("line-clamp-2");

  expect(screen.getByText("2026-03-01")).toHaveClass("ed-mono");
  expect(screen.getByText("9 分钟")).toHaveClass("ed-mono");

  // 「阅读全文 →」文字链接
  const readMore = screen.getByRole("link", { name: "阅读全文：Lead story" });
  expect(readMore).toHaveAttribute("href", "/posts/lead-story");
  expect(readMore).toHaveClass("ed-link");
  expect(readMore).toHaveTextContent("阅读全文→");

  // 封面链接对读屏隐藏且不可 Tab 聚焦（与标题重复）
  const coverLink = article.querySelector("a.ed-media");
  expect(coverLink).toHaveAttribute("aria-hidden", "true");
  expect(coverLink).toHaveAttribute("tabindex", "-1");
  expect(coverLink).toHaveAttribute("href", "/posts/lead-story");
});

test("featured card drops the cover column when the post has no cover", () => {
  render(<PostCardFeatured post={{ ...leadStory, coverImage: null }} />);

  expect(screen.getByTestId("post-featured").querySelector(".ed-media")).toBeNull();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});
