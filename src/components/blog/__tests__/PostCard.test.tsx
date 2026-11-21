import { render, screen, within } from "@testing-library/react";
import React from "react";
import { describe, expect, test, vi } from "vitest";
import { PostCard, type PostCardPost } from "../PostCard";

type ImageMockProps = React.ComponentProps<"img"> & {
  blurDataURL?: string;
  fill?: boolean;
  placeholder?: string;
  quality?: number;
};

const imageMock = vi.fn((props: ImageMockProps) => {
  void props;
  return null;
});

vi.mock("next/image", () => ({
  default: (props: React.ComponentProps<"img"> & { fill?: boolean; quality?: number }) => imageMock(props),
}));

function buildPost(overrides: Partial<PostCardPost> = {}): PostCardPost {
  return {
    id: "post-1",
    title: "Post with cover",
    slug: "post-with-cover",
    excerpt: "Excerpt",
    coverImage: "https://images.unsplash.com/photo-1",
    // 2026-03-01 08:00 Asia/Shanghai
    createdAt: "2026-03-01T00:00:00.000Z",
    readingTimeMinutes: 6,
    author: { id: "u1", name: "Ada", image: null },
    category: { name: "Tech", slug: "tech" },
    tags: [{ name: "Next", slug: "next" }],
    _count: { comments: 1, likes: 2 },
    viewCount: 10,
    ...overrides,
  };
}

describe("PostCard", () => {
  test("renders an editorial list row with a stacked date column, serif title link, meta and cover thumb", () => {
    imageMock.mockClear();

    render(<PostCard post={buildPost()} />);

    const row = screen.getByTestId("post-list-row");
    expect(row.tagName).toBe("ARTICLE");
    expect(row).toHaveClass("ed-row");
    expect(row.className).not.toContain("reader-feed-card");

    // 标题是整行唯一的主链接（伪元素铺满整行），默认 h3
    const heading = screen.getByRole("heading", { level: 3, name: "Post with cover" });
    expect(heading).toHaveClass("ed-row__title");
    expect(within(heading).getByRole("link", { name: "Post with cover" })).toHaveAttribute("href", "/posts/post-with-cover");
    expect(within(heading).getByRole("link")).toHaveClass("ed-row__link");
    // 旧版尾部 CTA 箭头列已移除
    expect(screen.queryByLabelText("继续阅读 Post with cover")).not.toBeInTheDocument();

    // 桌面日期列：两行「2026 / 03-01」
    const dateColumn = row.querySelector(".ed-row__date--desktop");
    expect(dateColumn).not.toBeNull();
    const time = dateColumn!.querySelector("time");
    expect(time).toHaveAttribute("datetime", "2026-03-01");
    expect(time).toHaveTextContent("202603-01");

    expect(screen.getByText("Excerpt")).toHaveClass("ed-row__excerpt", "line-clamp-2");

    // meta：分类、#标签、阅读时长，分类 / 标签可单独点击
    expect(screen.getByRole("link", { name: "Tech" })).toHaveAttribute("href", "/categories/tech");
    expect(screen.getByRole("link", { name: "#Next" })).toHaveAttribute("href", "/tags/next");
    expect(screen.getByText("6 分钟")).toHaveClass("ed-mono");

    expect(row.querySelector(".ed-row__thumb")).not.toBeNull();
    const imageProps = imageMock.mock.calls[0]?.[0];
    expect(imageProps?.sizes).toBe("(max-width: 640px) 6.5rem, 7.5rem");
    expect(imageProps?.alt).toBe("");
    expect(imageProps?.placeholder).toBe("blur");
    expect(imageProps?.blurDataURL).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  test("leaves the thumb column empty without drawing a media placeholder when there is no cover", () => {
    imageMock.mockClear();

    render(<PostCard post={buildPost({ coverImage: null, title: "Post without cover", slug: "post-without-cover" })} />);

    const row = screen.getByTestId("post-list-row");
    expect(row.querySelector(".ed-row__thumb")).toBeNull();
    expect(row.lastElementChild).toHaveAttribute("aria-hidden", "true");
    expect(row.lastElementChild?.childElementCount).toBe(0);
    expect(screen.queryByTestId("post-card-text-accent")).not.toBeInTheDocument();
    expect(screen.queryByText("夜读札记")).not.toBeInTheDocument();
    expect(imageMock).not.toHaveBeenCalled();
  });

  test("merges the date into the meta line on mobile and hides the tag there", () => {
    render(<PostCard post={buildPost()} />);

    const meta = screen.getByTestId("post-list-row").querySelector(".ed-row__meta");
    expect(meta).not.toBeNull();
    const mobileDate = meta!.firstElementChild;
    expect(mobileDate).toHaveClass("sm:hidden");
    expect(mobileDate).toHaveTextContent("2026-03-01");

    // 手机 meta 去掉 #标签
    expect(screen.getByRole("link", { name: "#Next" }).closest(".max-sm\\:hidden")).not.toBeNull();
  });

  test("uses a single-line month-day date for the short style", () => {
    render(<PostCard dateStyle="short" post={buildPost()} />);

    const row = screen.getByTestId("post-list-row");
    const time = row.querySelector(".ed-row__date--desktop time");
    expect(time).toHaveTextContent(/^03-01$/);
    expect(row.querySelector(".ed-row__meta")?.firstElementChild).toHaveTextContent("03-01");
    expect(row.querySelector(".ed-row__meta")?.firstElementChild).not.toHaveTextContent("2026");
  });

  test("renders a two-digit index column and moves the full date into meta for the index style", () => {
    render(<PostCard dateStyle="index" index={3} post={buildPost()} />);

    const row = screen.getByTestId("post-list-row");
    expect(row.querySelector(".ed-row__index")).toHaveTextContent("03");
    expect(row.querySelector(".ed-row__date--desktop")).toBeNull();
    expect(row.querySelector("time")).toBeNull();
    // 序号模式没有手机日期前缀，日期作为 meta 项出现一次
    expect(screen.getAllByText("2026-03-01")).toHaveLength(1);
  });

  test("prefixes featured posts with a 精选 label unless disabled", () => {
    const { rerender } = render(<PostCard post={buildPost({ featured: true })} />);
    expect(screen.getByText("精选")).toBeInTheDocument();

    rerender(<PostCard post={buildPost({ featured: true })} showFeaturedLabel={false} />);
    expect(screen.queryByText("精选")).not.toBeInTheDocument();

    rerender(<PostCard post={buildPost({ featured: false })} />);
    expect(screen.queryByText("精选")).not.toBeInTheDocument();
  });

  test("omits the category or tag from meta on taxonomy detail pages", () => {
    const { rerender } = render(<PostCard hideCategory post={buildPost()} />);
    expect(screen.queryByRole("link", { name: "Tech" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "#Next" })).toBeInTheDocument();

    rerender(<PostCard hideTag post={buildPost()} />);
    expect(screen.getByRole("link", { name: "Tech" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "#Next" })).not.toBeInTheDocument();
  });

  test("supports an h2 heading level", () => {
    render(<PostCard headingLevel="h2" post={buildPost()} />);
    expect(screen.getByRole("heading", { level: 2, name: "Post with cover" })).toBeInTheDocument();
  });
});
