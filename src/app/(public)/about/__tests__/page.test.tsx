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
