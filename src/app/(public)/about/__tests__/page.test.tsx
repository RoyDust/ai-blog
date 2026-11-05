import { render, screen, within } from "@testing-library/react";
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

vi.mock("@/lib/blog-settings", () => ({
  getBlogSettings: vi.fn(async () => ({
    siteName: "Configured Blog",
    siteDescription: "Configured description",
    siteUrl: "https://blog.example",
    locale: "zh-CN",
    profile: {
      subtitle: "Configured subtitle",
      tagline: "Configured tagline",
      bio: "Configured bio",
      intro: "Configured intro",
      githubUrl: "https://github.com/example",
      twitterUrl: "https://x.com/example",
    },
    about: {
      aboutTitle: "后台配置的关于",
      aboutParagraphs: ["后台配置的第一段", "后台配置的第二段"],
      nowTitle: "后台配置的动态",
      nowItems: ["后台配置的事项"],
      highlights: [{ title: "后台配置的亮点", description: "后台配置的亮点描述" }],
      stackTitle: "后台配置的技术栈",
      stack: [{ title: "后台配置的技术", description: "后台配置的技术描述" }],
      contactTitle: "后台配置的联系",
      contactDescription: "后台配置的联系描述",
    },
  })),
}));

test("about page renders configured personal homepage content", async () => {
  const { default: AboutPage } = await import("../page");
  const ui = await AboutPage();

  const { container } = render(ui as React.ReactElement);

  expect(screen.getByRole("heading", { level: 1, name: "RoyDust" })).toBeInTheDocument();
  expect(screen.getByText("后台个人信息驱动的作者资料。")).toBeInTheDocument();
  expect(screen.getByText("内容创作 / 前端体验 / 开源实践")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "后台配置的关于" })).toBeInTheDocument();
  expect(screen.getByText("后台配置的第一段")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "后台配置的动态" })).toBeInTheDocument();
  expect(screen.getByText("后台配置的事项")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "后台配置的亮点" })).toBeInTheDocument();
  expect(screen.getByText("后台配置的亮点描述")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /后台配置的技术栈/ })).toBeInTheDocument();
  expect(screen.getByText("后台配置的技术描述")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "后台配置的联系" })).toBeInTheDocument();
  expect(screen.getByText("后台配置的联系描述")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", "https://github.com/RoyDust");
  expect(screen.getByRole("link", { name: "Email" })).toHaveAttribute("href", "mailto:roy@example.com");
  expect(screen.getByRole("link", { name: "联系我" })).toHaveAttribute("href", "/contact");
  expect(screen.getByRole("link", { name: "访问 GitHub" })).toHaveAttribute("href", "https://github.com/RoyDust");

  const jsonLd = JSON.parse(container.querySelector('script[type="application/ld+json"]')?.textContent ?? "{}");
  expect(jsonLd).toMatchObject({
    "@type": "Person",
    name: "RoyDust",
    url: "https://blog.example/about",
    image: "https://example.com/avatar.png",
    description: "后台个人信息驱动的作者资料。",
    sameAs: ["https://github.com/RoyDust", "https://x.com/luoyichen12"],
  });
  expect(document.querySelector('link[rel="me"][href="https://github.com/RoyDust"]')).toBeInTheDocument();
});

test("about header uses the editorial masthead: eyebrow, round avatar, text links and a 2px rule", async () => {
  const { default: AboutPage } = await import("../page");
  const ui = await AboutPage();

  const { container } = render(ui as React.ReactElement);
  const header = container.querySelector("[data-about-section='intro']");

  expect(header).toHaveClass("border-b-2", "border-[var(--foreground)]");
  expect(header?.querySelector(".ed-eyebrow")).toHaveTextContent("关于");
  expect(header?.querySelector("h1")).toHaveClass("ed-serif");
  expect(header?.querySelector(".rounded-full")).toBeInTheDocument();

  // 站外链接加 ↗，邮箱用 →；都是文字链接，不再是带图标的按钮
  const github = screen.getByRole("link", { name: "GitHub" });
  const email = screen.getByRole("link", { name: "Email" });
  expect(github).toHaveClass("ed-link");
  expect(github).toHaveAttribute("target", "_blank");
  expect(github).toHaveTextContent("↗");
  expect(email).toHaveClass("ed-link");
  expect(email).toHaveTextContent("→");
  expect(container.querySelector("svg")).toBeNull();

  // 去掉光斑、光环与 onload 动画
  expect(container.querySelector(".blur-3xl, .blur-2xl, .ring-1, .onload-animation, .card-base")).toBeNull();
});

test("about body keeps sections on the paper: side-by-side story, indexed now list, highlight columns and stack list", async () => {
  const { default: AboutPage } = await import("../page");
  const ui = await AboutPage();

  const { container } = render(ui as React.ReactElement);

  const story = container.querySelector("[data-about-section='story']");
  expect(story).toHaveClass("lg:grid-cols-[minmax(0,1.15fr)_1px_minmax(0,0.85fr)]");
  const nowItem = within(story as HTMLElement).getByText("后台配置的事项").closest("li");
  expect(nowItem).toHaveClass("border-b");
  expect(nowItem?.querySelector(".ed-mono")).toHaveTextContent("01");

  const highlights = container.querySelector("[data-about-section='highlights']");
  expect(highlights?.querySelector(".md\\:grid-cols-3")).toBeInTheDocument();
  expect(within(highlights as HTMLElement).getByRole("heading", { name: "后台配置的亮点" })).toHaveClass("ed-serif");

  const stack = container.querySelector("[data-about-section='stack']");
  expect(stack?.querySelector(".sm\\:grid-cols-2")).toBeInTheDocument();
  expect(within(stack as HTMLElement).getByText("1")).toHaveClass("ed-mono");

  // 关于页不设主按钮：「联系我」是描边按钮
  expect(screen.getByRole("link", { name: "联系我" })).toHaveClass("ed-btn-outline");
  expect(container.querySelector(".ed-btn")).toBeNull();
  expect(container.querySelector("[class*='hover:-translate-y']")).toBeNull();
});
