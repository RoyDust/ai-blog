import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { getBlogSettings } = vi.hoisted(() => ({
  getBlogSettings: vi.fn(async () => ({
    siteName: "Inkforge 墨锻",
    siteDescription: "技术写作与 AI 选题笔记",
    siteUrl: "https://inkforge.example",
  })),
}));

vi.mock("@/lib/blog-settings", () => ({
  getBlogSettings,
}));

import TermsPage, { dynamic, generateMetadata } from "../page";

describe("public /terms page", () => {
  beforeEach(() => {
    getBlogSettings.mockClear();
  });

  test("uses force-dynamic and builds canonical metadata with real siteName", async () => {
    expect(dynamic).toBe("force-dynamic");

    const metadata = await generateMetadata();
    expect(metadata).toMatchObject({
      title: "服务条款",
      description: expect.stringContaining("Inkforge 墨锻"),
      alternates: { canonical: "https://inkforge.example/terms" },
    });
  });

  test("renders Direction A editorial terms copy with configured siteName and matches /register href", async () => {
    const ui = await TermsPage();
    const { container } = render(ui as React.ReactElement);

    expect(screen.getByRole("heading", { level: 1, name: "服务条款" })).toHaveClass("ed-serif");
    expect(screen.getByText("协议", { selector: ".ed-eyebrow" })).toBeInTheDocument();
    expect(screen.getByText("适用站点：Inkforge 墨锻")).toBeInTheDocument();
    expect(container.textContent).not.toContain("My Blog");

    expect(screen.getByRole("heading", { name: /服务范围与账号注册/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /评论与互动规范/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /内容版权与合理引用/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /返回账号注册/ })).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: /阅读隐私政策/ })).toHaveAttribute("href", "/privacy");

    expect(container.querySelector(".card-base, .reader-panel, .ed-btn, svg")).toBeNull();

    const registerSource = readFileSync(join(process.cwd(), "src/app/(auth)/register/page.tsx"), "utf8");
    expect(registerSource).toContain('href="/terms"');
  });
});
