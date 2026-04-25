import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/ai-models", () => ({
  getPublicAiModelOptions: vi.fn(async () => [
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
}));

describe("admin AI models page", () => {
  test("renders the current summary generator as the first selectable model", async () => {
    const { default: AdminAiModelsPage } = await import("../page");
    const ui = await AdminAiModelsPage();

    render(ui as React.ReactElement);

    expect(screen.getByRole("heading", { name: "AI 模型管理" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "模型列表" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "选择 文章摘要生成" })).toBeChecked();
    expect(screen.getByText("当前首选")).toBeInTheDocument();
    expect(screen.getAllByText("summary-model").length).toBeGreaterThan(0);
    expect(screen.getByText("https://compat.example/v1/chat/completions")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /新增模型/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /测试/ })).toBeInTheDocument();
  });
});
