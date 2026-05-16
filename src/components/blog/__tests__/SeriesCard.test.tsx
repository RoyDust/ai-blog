import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, test, vi } from "vitest";

import { SeriesCard } from "../SeriesCard";

type ImageMockProps = React.ComponentProps<"img"> & { fill?: boolean; quality?: number };

const imageMock = vi.fn((props: ImageMockProps) => {
  void props;
  return null;
});

vi.mock("next/image", () => ({
  default: (props: ImageMockProps) => imageMock(props),
}));

describe("SeriesCard", () => {
  test("links to a series and renders published post count", () => {
    render(
      <SeriesCard
        series={{
          id: "s1",
          title: "Next.js 系列",
          slug: "nextjs-series",
          description: "从基础到实践",
          coverImage: "https://example.com/cover.jpg",
          _count: { posts: 4 },
        }}
      />,
    );

    expect(screen.getByRole("link", { name: "Next.js 系列" })).toHaveAttribute("href", "/series/nextjs-series");
    expect(screen.getByText("4 篇文章")).toBeInTheDocument();
    expect(imageMock).toHaveBeenCalled();
  });
});
