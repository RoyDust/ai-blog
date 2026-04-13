import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, test, vi } from "vitest";
import { PostCard } from "../PostCard";

const imageMock = vi.fn(() => null);

vi.mock("next/image", () => ({
  default: (props: React.ComponentProps<"img"> & { fill?: boolean; quality?: number }) => imageMock(props),
}));

describe("PostCard", () => {
  test("renders an editorial card without duplicate chevron CTA treatment", () => {
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
    expect(card.className).toContain("md:grid-cols-[minmax(0,1fr)_15rem]");
    expect(screen.queryByTestId("post-card-chevron")).not.toBeInTheDocument();
    expect(screen.getByText("Excerpt").className).toContain("line-clamp-3");
    expect(imageMock.mock.calls[0][0].sizes).toBe("(max-width: 768px) 100vw, 15rem");
  });
});
