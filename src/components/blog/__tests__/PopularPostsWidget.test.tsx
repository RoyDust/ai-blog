import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { PopularPostsWidget } from "../PopularPostsWidget";

describe("PopularPostsWidget", () => {
  test("does not render without popular posts", () => {
    const { container } = render(<PopularPostsWidget posts={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  test("renders ranked popular post links", () => {
    render(
      <PopularPostsWidget
        posts={[
          { id: "p1", title: "Popular Post", slug: "popular-post", viewCount: 1280 },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "热门文章" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Popular Post/ })).toHaveAttribute("href", "/posts/popular-post");
    expect(screen.getByText("1,280")).toBeInTheDocument();
  });
});
