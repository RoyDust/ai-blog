import { render, screen } from "@testing-library/react";
import React from "react";
import { expect, test, vi } from "vitest";
import { PostCardFeatured } from "../PostCardFeatured";

vi.mock("next/image", () => ({
  default: (
    props: React.ComponentProps<"img"> & {
      blurDataURL?: string;
      fill?: boolean;
      placeholder?: string;
      priority?: boolean;
      quality?: number;
    },
  ) => {
    const {
      blurDataURL: _blurDataURL,
      fill: _fill,
      placeholder: _placeholder,
      priority: _priority,
      quality: _quality,
      ...imageProps
    } = props;
    void _blurDataURL;
    void _fill;
    void _placeholder;
    void _priority;
    void _quality;
    return React.createElement("img", { ...imageProps, alt: imageProps.alt ?? "" });
  },
}));

test("featured card exposes editorial lead-story framing", () => {
  const { container } = render(
    <PostCardFeatured
      post={{
        title: "Lead story",
        slug: "lead-story",
        excerpt: "Longer summary for the lead story.",
        coverImage: "https://images.unsplash.com/photo-2",
        createdAt: "2026-03-01T00:00:00.000Z",
        category: { name: "Engineering", slug: "engineering" },
        tags: [{ name: "Next", slug: "next" }],
      }}
    />,
  );

  expect(container.querySelector("article")?.className).toContain("reader-feature-card");
  expect(screen.getByText("精选文章")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Lead story" })).toHaveAttribute("href", "/posts/lead-story");
  expect(screen.getByRole("link", { name: /继续阅读/ })).toHaveAttribute("href", "/posts/lead-story");
  expect(screen.getAllByText("Engineering").length).toBeGreaterThan(0);
});
