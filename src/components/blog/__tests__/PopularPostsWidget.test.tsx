import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { PopularPostsWidget } from "../PopularPostsWidget";

describe("PopularPostsWidget", () => {
  test("does not render without popular posts", () => {
    const { container } = render(<PopularPostsWidget posts={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  test("renders a loading skeleton before popular posts resolve", () => {
    render(<PopularPostsWidget isLoading posts={[]} />);

    const heading = screen.getByRole("heading", { name: "热门" });
    expect(heading).toHaveClass("ed-serif");
    const skeleton = screen.getByTestId("popular-posts-skeleton");
    expect(skeleton).toHaveAttribute("aria-hidden", "true");
    expect(skeleton.querySelectorAll("li")).toHaveLength(3);
    expect(skeleton.querySelectorAll(".ed-skel").length).toBeGreaterThan(0);
    expect(screen.getByRole("region", { name: "热门" })).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  test("renders ranked popular post links with mono indexes", () => {
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

    const region = screen.getByRole("region", { name: "热门" });
    expect(region).toHaveAttribute("aria-busy", "false");
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/posts/popular-post",
      "/posts/second-popular-post",
      "/posts/third-popular-post",
    ]);
    expect(screen.queryByRole("link", { name: /Fourth Popular Post/ })).not.toBeInTheDocument();

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items.map((item) => within(item).getByText(/^\d{2}$/).textContent)).toEqual(["01", "02", "03"]);
    expect(within(items[0]).getByText("01")).toHaveClass("ed-mono");
    expect(within(items[0]).getByText("Popular Post")).toHaveClass("line-clamp-2");

    // 浏览量不再作为可见数字展示，只保留为悬停提示
    expect(screen.queryByText("1,280")).not.toBeInTheDocument();
    expect(within(items[0]).getByRole("link")).toHaveAttribute("title", "1,280 次阅读");
  });

  test("accepts a custom section title", () => {
    render(<PopularPostsWidget posts={[{ id: "p1", title: "Popular Post", slug: "popular-post", viewCount: 1 }]} title="热门文章" />);

    expect(screen.getByRole("region", { name: "热门文章" })).toBeInTheDocument();
  });
});
