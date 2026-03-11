import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, test, vi } from "vitest";

import { PostCard } from "../PostCard";

const imageMock = vi.fn(() => null);

vi.mock("next/image", () => ({
  default: (props: React.ComponentProps<"img"> & { fill?: boolean; quality?: number }) => imageMock(props),
}));

describe("PostCard", () => {
  test("uses conservative image loading settings for listing cards", () => {
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

    const postLinks = screen.getAllByRole("link", { name: "Post with cover" });

    expect(postLinks).toHaveLength(2);
    expect(postLinks[0]).toHaveAttribute("href", "/posts/post-with-cover");
    expect(postLinks[1]).toHaveAttribute("href", "/posts/post-with-cover");

    expect(imageMock).toHaveBeenCalledTimes(1);

    const imageProps = imageMock.mock.calls[0][0];

    expect(imageProps.loading).toBe("lazy");
    expect(imageProps.quality).toBe(70);
    expect(imageProps.sizes).toBe(
      "(max-width: 768px) calc(100vw - 2rem), (max-width: 1200px) 28vw, 22rem",
    );
  });
});
