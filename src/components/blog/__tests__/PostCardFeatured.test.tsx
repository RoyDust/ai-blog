import { render, screen } from "@testing-library/react";
import React from "react";
import { expect, test, vi } from "vitest";
import { PostCardFeatured } from "../PostCardFeatured";

vi.mock("next/image", () => ({
  default: (props: React.ComponentProps<"img"> & { fill?: boolean; priority?: boolean }) => {
    const { fill: _fill, priority: _priority, ...imageProps } = props;
    void _fill;
    void _priority;
    return React.createElement("img", { ...imageProps, alt: imageProps.alt ?? "" });
  },
}));

test("featured card exposes editorial lead-story framing", () => {
  render(
    <PostCardFeatured
      post={{
        title: "Lead story",
        slug: "lead-story",
        excerpt: "Longer summary for the lead story.",
        coverImage: "https://images.unsplash.com/photo-2",
        createdAt: "2026-03-01T00:00:00.000Z",
        category: { name: "Engineering", slug: "engineering" },
      }}
    />,
  );

  expect(screen.getByText("精选文章")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Lead story" })).toHaveAttribute("href", "/posts/lead-story");
  expect(screen.getByText("Engineering")).toBeInTheDocument();
});
