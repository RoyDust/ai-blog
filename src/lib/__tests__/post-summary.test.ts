import { afterEach, describe, expect, test, vi } from "vitest";

import {
  generatePostSummary,
  getPostSummaryMaxInputChars,
  getPostSummaryTimeoutMs,
} from "@/lib/post-summary";
import type { AiModelOption } from "@/lib/ai-models";

const aiModel: AiModelOption = {
  id: "model-1",
  name: "Summary model",
  description: "",
  provider: "openai-compatible",
  baseUrl: "https://api.example.com/v1",
  requestPath: "/chat/completions",
  model: "summary-model",
  apiKey: "test-key",
  apiKeyEnv: "database",
  baseUrlEnv: "database",
  modelEnv: "database",
  capabilities: ["post-summary"],
  defaultFor: ["post-summary"],
  source: "database",
  editable: true,
  deletable: true,
  enabled: true,
  status: "ready",
  hasApiKey: true,
};

describe("post summary generation", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  test("uses configurable timeout and input length limits", () => {
    process.env.AI_POST_SUMMARY_TIMEOUT_MS = "90000";
    process.env.AI_POST_SUMMARY_MAX_INPUT_CHARS = "5000";

    expect(getPostSummaryTimeoutMs()).toBe(90_000);
    expect(getPostSummaryMaxInputChars()).toBe(5_000);
  });

  test("returns a clear message when the upstream summary request times out", async () => {
    process.env.AI_POST_SUMMARY_TIMEOUT_MS = "1000";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("The operation was aborted due to timeout", "TimeoutError")));

    await expect(generatePostSummary({ aiModel, title: "标题", content: "正文" })).rejects.toThrow(
      "摘要生成超时，请稍后重试",
    );
  });

  test("truncates long article content before sending it to the model", async () => {
    process.env.AI_POST_SUMMARY_MAX_INPUT_CHARS = "10";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "生成后的摘要。" } }],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(generatePostSummary({ aiModel, title: "标题", content: "一".repeat(50) })).resolves.toBe("生成后的摘要。");

    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const prompt = body.messages[1].content as string;
    expect(prompt).toContain("一".repeat(10));
    expect(prompt).toContain("已截取前 10 字用于生成摘要");
    expect(prompt).not.toContain("一".repeat(50));
  });
});
