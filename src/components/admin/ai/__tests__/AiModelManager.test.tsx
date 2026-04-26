import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { PublicAiModelOption } from "@/lib/ai-models";

import { AiModelManager } from "../AiModelManager";

const environmentModel: PublicAiModelOption = {
  id: "post-summary-openai-compatible",
  name: "文章摘要生成",
  description: "内置摘要模型",
  provider: "openai-compatible",
  baseUrl: "https://compat.example/v1",
  requestPath: "/chat/completions",
  model: "env-summary",
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
};

const databaseModel: PublicAiModelOption = {
  id: "db-model-1",
  name: "自定义摘要",
  description: "数据库模型",
  provider: "openai-compatible",
  baseUrl: "https://db.example/v1",
  requestPath: "/chat/completions",
  model: "db-summary",
  apiKeyEnv: "database",
  baseUrlEnv: "database",
  modelEnv: "database",
  capabilities: ["post-summary"],
  defaultFor: [],
  source: "database",
  editable: true,
  deletable: true,
  enabled: true,
  status: "ready",
  hasApiKey: true,
  lastTestedAt: null,
  lastTestStatus: null,
  lastTestMessage: null,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("AiModelManager", () => {
  test("switches the summary default model from the model list", async () => {
    const updatedModels = [
      { ...environmentModel, defaultFor: [] },
      { ...databaseModel, defaultFor: ["post-summary"] },
    ] satisfies PublicAiModelOption[];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: updatedModels[1] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: updatedModels }),
      });

    vi.stubGlobal("fetch", fetchMock);

    render(<AiModelManager initialModels={[environmentModel, databaseModel]} />);

    fireEvent.click(screen.getByRole("radio", { name: "选择 自定义摘要" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/ai/models/default",
        expect.objectContaining({ method: "POST" }),
      );
    });

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      modelId: "db-model-1",
      capability: "post-summary",
    });
    expect(await screen.findByText("已切换为「自定义摘要」。")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "选择 自定义摘要" })).toBeChecked();
  });
});
