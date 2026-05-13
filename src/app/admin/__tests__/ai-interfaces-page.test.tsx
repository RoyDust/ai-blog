import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, test, vi } from "vitest";

const getBlogSettingsMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    siteName: "RoyDust Blog",
    siteUrl: "https://example.com",
  }),
);

vi.mock("@/lib/blog-settings", () => ({
  getBlogSettings: getBlogSettingsMock,
}));

describe("admin AI interfaces page", () => {
  test("renders the AI interface catalog and agent prompt", async () => {
    const { default: AdminAiInterfacesPage } = await import("../ai/interfaces/page");
    const ui = await AdminAiInterfacesPage();

    render(ui as React.ReactElement);

    expect(screen.getByRole("heading", { name: "AI 接口目录" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "给 AI agent 的使用提示词" })).toBeInTheDocument();
    expect(screen.getByText("Agent 可调用接口")).toBeInTheDocument();
    expect(screen.getByText("后台内部 AI 接口")).toBeInTheDocument();
    expect(screen.getByText("定时任务接口")).toBeInTheDocument();

    expect(screen.getByText("/llms.txt")).toBeInTheDocument();
    expect(screen.getAllByText("/api/ai/drafts").length).toBeGreaterThan(0);
    expect(screen.getByText("/api/admin/posts/metadata")).toBeInTheDocument();
    expect(screen.getByText("/api/admin/covers/generate")).toBeInTheDocument();
    expect(screen.getByText("/api/cron/ai-news")).toBeInTheDocument();

    expect(screen.getByText(/scripts\/create-ai-api-token\.mjs/)).toBeInTheDocument();
    expect(screen.getByText((content) => content.includes("https://example.com/api/ai/openapi"))).toBeInTheDocument();
    expect(screen.getAllByText((content) => content.includes("Authorization: Bearer <AI_TOKEN>")).length).toBeGreaterThan(0);
    expect(getBlogSettingsMock).toHaveBeenCalledTimes(1);
  });
});
