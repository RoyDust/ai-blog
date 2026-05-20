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
          { id: "p2", title: "Second Popular Post", slug: "second-popular-post", viewCount: 640 },
          { id: "p3", title: "Third Popular Post", slug: "third-popular-post", viewCount: 320 },
          { id: "p4", title: "Fourth Popular Post", slug: "fourth-popular-post", viewCount: 160 },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "热门文章" })).toBeInTheDocument();
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/posts/popular-post",
      "/posts/second-popular-post",
      "/posts/third-popular-post",
    ]);
    expect(screen.queryByRole("link", { name: /Fourth Popular Post/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("1,280")).toBeInTheDocument();
  });
});
