import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { SeriesNav } from "../SeriesNav";

describe("SeriesNav", () => {
  test("marks the current post and links adjacent posts", () => {
    render(
      <SeriesNav
        series={{ title: "工程系列", slug: "engineering" }}
        currentSlug="second"
        posts={[
          { title: "First", slug: "first", seriesOrder: 1 },
          { title: "Second", slug: "second", seriesOrder: 2 },
          { title: "Third", slug: "third", seriesOrder: 3 },
        ]}
      />,
    );

    expect(screen.getByRole("navigation", { name: "工程系列 系列导航" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Second/ })).toHaveAttribute("aria-current", "page");
    expect(screen.getAllByRole("link", { name: /First/ })[0]).toHaveAttribute("href", "/posts/first");
    expect(screen.getAllByRole("link", { name: /Third/ })[0]).toHaveAttribute("href", "/posts/third");
    expect(screen.getByTestId("series-progress-bar")).toHaveStyle({ width: "67%" });
  });
});
