import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { FilterBar } from "../FilterBar";

test("filter bar renders active chips and a reset entry when filters are present", () => {
  render(
    <FilterBar
      search="react"
      category="frontend"
      tag="nextjs"
      categories={[{ name: "Frontend", slug: "frontend" }]}
      tags={[{ name: "Next.js", slug: "nextjs" }]}
    />,
  );

  expect(screen.getByDisplayValue("react")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "关键词: react" })).toHaveAttribute("href", "/posts?category=frontend&tag=nextjs");
  expect(screen.getByRole("link", { name: "清空筛选" })).toHaveAttribute("href", "/posts");
});
