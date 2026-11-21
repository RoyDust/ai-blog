import { render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { getPublicAiModelOptionsMock, getServerSessionMock, redirectError, redirectMock } = vi.hoisted(() => {
  const nextRedirectError = new Error("NEXT_REDIRECT");
  return {
    getPublicAiModelOptionsMock: vi.fn(async () => [
      {
        id: "post-summary-openai-compatible",
        name: "文章摘要生成",
        description: "用于后台编辑器的一键中文摘要，当前走 OpenAI Chat Completions 兼容接口。",
        provider: "openai-compatible",
        baseUrl: "https://compat.example/v1",
        requestPath: "/chat/completions",
        model: "summary-model",
        apiKeyEnv: "AI_OPENAI_COMPAT_API_KEY",
        baseUrlEnv: "AI_OPENAI_COMPAT_BASE_URL",
        modelEnv: "AI_OPENAI_COMPAT_MODEL",
        capabilities: ["post-summary"],
        defaultFor: ["post-summary"],
        source: "environment",
        editable: false,
        deletable: false,
        enabled: true,
        status: "ready",
        hasApiKey: true,
        lastTestedAt: null,
        lastTestStatus: null,
        lastTestMessage: null,
      },
    ]),
    getServerSessionMock: vi.fn(),
    redirectError: nextRedirectError,
    redirectMock: vi.fn(() => {
      throw nextRedirectError;
    }),
  };
});

vi.mock("next-auth", () => ({
  getServerSession: getServerSessionMock,
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

vi.mock("next/navigation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/navigation")>();
  return {
    ...actual,
    redirect: redirectMock,
  };
});

vi.mock("@/lib/ai-models", () => ({
  getPublicAiModelOptions: getPublicAiModelOptionsMock,
}));

describe("admin AI models page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getServerSessionMock.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
  });

  test("redirects demoted USER sessions before querying AI model options", async () => {
    getServerSessionMock.mockResolvedValueOnce({ user: { id: "user-1", role: "USER" } });

    const { default: AdminAiModelsPage } = await import("../page");

    await expect(AdminAiModelsPage()).rejects.toThrow(redirectError);
    expect(redirectMock).toHaveBeenCalledWith("/?login=1&error=not-admin&callbackUrl=%2Fadmin");
    expect(getPublicAiModelOptionsMock).not.toHaveBeenCalled();
  });

  test("renders the current summary generator as the first selectable model", async () => {
    const { default: AdminAiModelsPage } = await import("../page");
    const ui = await AdminAiModelsPage();

    render(ui as React.ReactElement);

    expect(screen.getByRole("heading", { name: "AI 配置选择" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "按能力选择默认模型" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "模型库" })).toBeInTheDocument();
    expect(screen.getByText("当前接入范围")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "选择 文章摘要 文章摘要生成" })).toBeChecked();
    expect(screen.getAllByText("当前默认").length).toBeGreaterThan(0);
    expect(screen.getAllByText("summary-model").length).toBeGreaterThan(0);
    expect(screen.getByText("https://compat.example/v1/chat/completions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /新增模型/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /测试/ })).toBeInTheDocument();
  });
});
