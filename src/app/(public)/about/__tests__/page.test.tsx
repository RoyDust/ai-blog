import { render, screen } from "@testing-library/react";
import React from "react";
import { expect, test } from "vitest";

test("about page renders editorial personal homepage content", async () => {
  const { default: AboutPage } = await import("../page");
  const ui = AboutPage();

  render(ui as React.ReactElement);

  expect(screen.getByRole("heading", { name: "Zhang Wei" })).toBeInTheDocument();
  expect(screen.getByText("全栈开发者，热爱开源和技术分享。专注于 React 生态和现代 Web 开发。")).toBeInTheDocument();
  expect(screen.getByText("内容创作 / 前端体验 / 开源实践")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "关于我" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "我在做什么" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "技术栈" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "联系我" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", "https://github.com");
});

test("about page wires in staged motion classes", async () => {
  const { default: AboutPage } = await import("../page");
  const ui = AboutPage();

  const { container } = render(ui as React.ReactElement);

  const sections = container.querySelectorAll("section");

  expect(sections).toHaveLength(5);
  expect(sections[0]).toHaveClass("onload-animation");
  expect(sections[1]).toHaveClass("onload-animation");
  expect(sections[2]).toHaveClass("stagger-children");
  expect(sections[3]).toHaveClass("onload-animation");
  expect(sections[3].querySelector(".grid")).toHaveClass("stagger-children");
  expect(sections[4]).toHaveClass("onload-animation");
});

test("about page cards include richer hover feedback hooks", async () => {
  const { default: AboutPage } = await import("../page");
  const ui = AboutPage();

  const { container } = render(ui as React.ReactElement);

  const sections = container.querySelectorAll("section");
  const highlightCards = sections[2].querySelectorAll("article");
  const stackCards = sections[3].querySelectorAll(".grid > div");

  expect(highlightCards[0]).toHaveClass("group");
  expect(highlightCards[0]).toHaveClass("hover:-translate-y-1");
  expect(highlightCards[0]).toHaveClass("duration-300");

  expect(stackCards[0]).toHaveClass("group");
  expect(stackCards[0]).toHaveClass("hover:-translate-y-1");
  expect(stackCards[0]).toHaveClass("transition-all");
});
