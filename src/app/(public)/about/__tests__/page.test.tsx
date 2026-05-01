import { render, screen } from "@testing-library/react";
import React from "react";
import { expect, test, vi } from "vitest";

vi.mock("@/lib/public-profile", () => ({
  getPublicProfile: vi.fn(async () => ({
    name: "RoyDust",
    initials: "RD",
    avatar: "https://example.com/avatar.png",
    email: "roy@example.com",
    subtitle: "专注前端开发与工程实践",
    tagline: "内容创作 / 前端体验 / 开源实践",
    bio: "后台个人信息驱动的作者资料。",
    intro: "我更喜欢把个人主页做成一个适合停留和阅读的地方。",
    links: [
      { kind: "github", name: "GitHub", url: "https://github.com/RoyDust" },
      { kind: "twitter", name: "Twitter", url: "https://x.com/luoyichen12" },
      { kind: "email", name: "Email", url: "mailto:roy@example.com" },
    ],
  })),
}));

test("about page renders editorial personal homepage content", async () => {
  const { default: AboutPage } = await import("../page");
  const ui = await AboutPage();

  render(ui as React.ReactElement);

  expect(screen.getByRole("heading", { name: "RoyDust" })).toBeInTheDocument();
  expect(screen.getByText("后台个人信息驱动的作者资料。")).toBeInTheDocument();
  expect(screen.getByText("内容创作 / 前端体验 / 开源实践")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "关于我" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "我在做什么" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "技术栈" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "联系我" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", "https://github.com/RoyDust");
  expect(screen.getByRole("link", { name: "Email" })).toHaveAttribute("href", "mailto:roy@example.com");
  expect(screen.getByRole("link", { name: "发送邮件" })).toHaveAttribute("href", "mailto:roy@example.com");
});

test("about page wires in staged motion classes", async () => {
  const { default: AboutPage } = await import("../page");
  const ui = await AboutPage();

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
  const ui = await AboutPage();

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
