import { act, renderHook, waitFor } from "@testing-library/react";
import { SWRConfig, mutate as clearSwrCache } from "swr";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { ReactNode } from "react";

const toastMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  message: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: toastMocks,
}));

import { useAdminAiNews } from "../hooks/useAdminAiNews";

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
        {children}
      </SWRConfig>
    );
  };
}

function jsonResponse(data: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  };
}

const modelList = [
  {
    id: "model-1",
    name: "日报模型",
    description: "测试模型",
    provider: "openai-compatible",
    baseUrl: "https://example.com/v1",
    requestPath: "/chat/completions",
    model: "qwen-news",
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
    lastTestStatus: null,
    lastTestMessage: null,
  },
];

describe("useAdminAiNews async 202 runId polling", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearSwrCache(() => true, undefined, { revalidate: false });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("polls GET /api/admin/ai-news/run?runId=... after 202 queued response until SUCCEEDED", async () => {
    let currentRunStatus: "RUNNING" | "SUCCEEDED" = "RUNNING";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/admin/ai/models") {
        return jsonResponse({ success: true, data: modelList });
      }
      if (url.startsWith("/api/admin/ai-news/sources?")) {
        return jsonResponse({
          success: true,
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
          summary: { enabledCount: 0, enabledSourceIds: [] },
        });
      }
      if (url === "/api/admin/ai-news/run" && init?.method === "POST") {
        return jsonResponse(
          {
            success: true,
            data: {
              operation: "queued",
              runId: "run-async-1",
              date: "2026-04-29",
              run: { id: "run-async-1", status: "RUNNING" },
            },
          },
          202,
        );
      }
      if (url === "/api/admin/ai-news/run?runId=run-async-1") {
        if (currentRunStatus === "RUNNING") {
          currentRunStatus = "SUCCEEDED";
          return jsonResponse(
            {
              success: true,
              data: {
                id: "run-async-1",
                runDate: "2026-04-29T00:00:00.000Z",
                trigger: "MANUAL",
                status: "RUNNING",
                sourceCount: 0,
                failureCount: 0,
                published: false,
                createdAt: "2026-04-29T08:00:00.000Z",
              },
            },
            202,
          );
        }

        return jsonResponse({
          success: true,
          data: {
            id: "run-async-1",
            runDate: "2026-04-29T00:00:00.000Z",
            trigger: "MANUAL",
            status: "SUCCEEDED",
            sourceCount: 6,
            rawCandidateCount: 8,
            dedupedCandidateCount: 6,
            scoredCandidateCount: 6,
            selectedCandidateCount: 4,
            qualityScore: 89,
            failureCount: 0,
            postId: "post-async-1",
            postTitle: "2026-04-29 AI 日报：异步完成",
            postSlug: "ai-daily-2026-04-29",
            published: true,
            createdAt: "2026-04-29T08:00:00.000Z",
          },
        });
      }
      if (url === "/api/admin/ai-news/run") {
        return jsonResponse({ success: true, data: [] });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAdminAiNews(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.selectedModelId).toBe("model-1");
    });

    act(() => {
      result.current.setDate("2026-04-29");
    });

    let started = false;
    await act(async () => {
      started = await result.current.runNewsGeneration(false);
    });
    expect(started).toBe(true);
    expect(toastMocks.message).toHaveBeenCalledWith("AI 日报任务已启动，正在后台生成...");

    await waitFor(
      () => {
        expect(result.current.running).toBe(false);
        expect(result.current.result).toMatchObject({
          operation: "created",
          published: true,
          post: {
            id: "post-async-1",
            title: "2026-04-29 AI 日报：异步完成",
            slug: "ai-daily-2026-04-29",
            published: true,
          },
        });
      },
      { timeout: 5000 },
    );

    expect(toastMocks.success).toHaveBeenCalledWith("AI 日报已生成并上线");
  });

  test("clears activeRunState when polling /api/admin/ai-news/run?runId=... returns 404 so generate button never deadlocks", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/admin/ai/models") {
        return jsonResponse({ success: true, data: modelList });
      }
      if (url.startsWith("/api/admin/ai-news/sources?")) {
        return jsonResponse({
          success: true,
          data: [],
          pagination: { page: 1, limit: 10, total: 0, totalPages: 1 },
          summary: { enabledCount: 0, enabledSourceIds: [] },
        });
      }
      if (url === "/api/admin/ai-news/run" && init?.method === "POST") {
        return jsonResponse(
          {
            success: true,
            data: {
              operation: "queued",
              runId: "run-missing-404",
              date: "2026-04-29",
              run: { id: "run-missing-404", status: "RUNNING" },
            },
          },
          202,
        );
      }
      if (url === "/api/admin/ai-news/run?runId=run-missing-404") {
        return jsonResponse({ error: "AI news run not found" }, 404);
      }
      if (url === "/api/admin/ai-news/run") {
        return jsonResponse({ success: true, data: [] });
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAdminAiNews(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.selectedModelId).toBe("model-1");
    });

    await act(async () => {
      await result.current.runNewsGeneration(false);
    });

    await waitFor(() => {
      expect(result.current.running).toBe(false);
    });
    expect(toastMocks.error).toHaveBeenCalled();
  });
});
