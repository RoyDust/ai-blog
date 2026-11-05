import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { SeriesNav } from "../SeriesNav";

const posts = [
  { title: "First", slug: "first", seriesOrder: 1 },
  { title: "Second", slug: "second", seriesOrder: 2 },
  { title: "Third", slug: "third", seriesOrder: 3 },
];

describe("SeriesNav", () => {
  test("renders a collapsed strip with position, progress and adjacent links", () => {
    render(<SeriesNav series={{ title: "工程系列", slug: "engineering" }} currentSlug="second" posts={posts} />);

    const nav = screen.getByRole("navigation", { name: "工程系列 系列导航" });
    expect(nav.className).toContain("series-strip");
    expect(screen.getByRole("link", { name: "工程系列" })).toHaveAttribute("href", "/series/engineering");
    expect(screen.getByText("第 2 / 3 篇")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "上一篇：First" })).toHaveAttribute("href", "/posts/first");
    expect(screen.getByRole("link", { name: "下一篇：Third" })).toHaveAttribute("href", "/posts/third");
    expect(screen.getByRole("progressbar", { name: "系列进度" })).toHaveAttribute("aria-valuenow", "2");
    expect(screen.getByTestId("series-progress-bar")).toHaveStyle({ width: "67%" });

    const toggle = screen.getByRole("button", { name: /展开全部\s*3\s*篇/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("link", { name: /Second/ })).not.toBeInTheDocument();
  });

  test("expands to the full numbered list with the current post marked, then collapses", async () => {
    render(<SeriesNav series={{ title: "工程系列", slug: "engineering" }} currentSlug="second" posts={posts} />);

    fireEvent.click(screen.getByRole("button", { name: /展开全部/ }));

    const current = screen.getByRole("link", { name: /Second/ });
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current).toHaveTextContent("02");
    expect(current).toHaveTextContent("正在阅读");
    expect(screen.getAllByRole("link", { name: /First/ }).map((link) => link.getAttribute("href"))).toContain("/posts/first");

    const collapse = await screen.findByRole("button", { name: "收起列表" });
    expect(collapse).toHaveAttribute("aria-expanded", "true");
  });

  test("hides the previous link on the first post", () => {
    render(<SeriesNav series={{ title: "工程系列", slug: "engineering" }} currentSlug="first" posts={posts} />);

    expect(screen.queryByRole("link", { name: /上一篇/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "下一篇：Second" })).toBeInTheDocument();
  });
});
