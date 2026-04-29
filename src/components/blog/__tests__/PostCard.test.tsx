import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, test, vi } from "vitest";
import { PostCard } from "../PostCard";

type ImageMockProps = React.ComponentProps<"img"> & { fill?: boolean; quality?: number };

const imageMock = vi.fn((props: ImageMockProps) => {
  void props;
  return null;
});

vi.mock("next/image", () => ({
  default: (props: React.ComponentProps<"img"> & { fill?: boolean; quality?: number }) => imageMock(props),
}));

describe("PostCard", () => {
  test("renders a Night Reader feed card with cover media and a compact CTA", () => {
    imageMock.mockClear();

    render(
      <PostCard
        post={{
          id: "post-1",
          title: "Post with cover",
          slug: "post-with-cover",
          excerpt: "Excerpt",
          coverImage: "https://images.unsplash.com/photo-1",
          createdAt: "2026-03-01T00:00:00.000Z",
          author: { id: "u1", name: "Ada", image: null },
          category: { name: "Tech", slug: "tech" },
          tags: [{ name: "Next", slug: "next" }],
          _count: { comments: 1, likes: 2 },
          viewCount: 10,
        }}
      />,
    );

    const card = screen.getByRole("article");
    expect(card.className).toContain("reader-feed-card");
    expect(card.className).toContain("md:grid-cols-[10.75rem_minmax(0,1fr)_2.75rem]");
    expect(screen.getByLabelText("继续阅读 Post with cover")).toHaveAttribute("href", "/posts/post-with-cover");
    expect(screen.getByText("Excerpt").className).toContain("line-clamp-3");
    expect(imageMock.mock.calls[0]?.[0].sizes).toBe("(max-width: 768px) 100vw, 11rem");
  });

  test("renders a dedicated text-only variant without media filler", () => {
    imageMock.mockClear();

    render(
      <PostCard
        post={{
          id: "post-2",
          title: "Post without cover",
          slug: "post-without-cover",
          excerpt: "No image excerpt",
          coverImage: null,
          createdAt: "2026-03-02T00:00:00.000Z",
          author: { id: "u2", name: "Lin", image: null },
          category: { name: "Design", slug: "design" },
          tags: [{ name: "UI", slug: "ui" }],
          _count: { comments: 4, likes: 8 },
          viewCount: 18,
        }}
      />,
    );

    const card = screen.getByRole("article");
    expect(card.className).toContain("reader-feed-card");
    expect(card.className).toContain("post-card--text-only");
    expect(card.className).not.toContain("md:grid-cols-[10.75rem_minmax(0,1fr)_2.75rem]");
    expect(screen.queryByLabelText("阅读 Post without cover")).not.toBeInTheDocument();
    expect(screen.getByTestId("post-card-text-accent")).toBeInTheDocument();
    expect(imageMock).not.toHaveBeenCalled();
  });
});
