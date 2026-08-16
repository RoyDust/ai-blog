import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { mutate as clearSwrCache } from "swr";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { ApiOperationLogsClient } from "../ApiOperationLogsClient";

function buildLog(id: string, path: string) {
  return {
    id,
    requestId: `req-${id}`,
    method: "GET",
    path,
    route: "/api/admin/posts",
    scope: "admin",
    operation: "admin.posts.read",
    statusCode: 200,
    success: true,
    durationMs: 12,
    actorType: "user",
    actorUserId: "admin-1",
    actorClientId: null,
    actorLabel: "Admin",
    ipHash: null,
    userAgent: null,
    query: null,
    requestBody: null,
    errorName: null,
    errorMessage: null,
    metadata: null,
    createdAt: "2026-05-30T00:00:00.000Z",
  };
}

describe("ApiOperationLogsClient", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearSwrCache(() => true, undefined, { revalidate: false });
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const isSecondPage = url.includes("page=2");
      const data = {
        items: [buildLog(isSecondPage ? "log-41" : "log-1", isSecondPage ? "/api/admin/comments" : "/api/admin/posts")],
        nextCursor: null,
        pagination: {
          page: isSecondPage ? 2 : 1,
          limit: 40,
          total: 45,
          totalPages: 2,
        },
        summary: {
          totalCount: 45,
          failedCount: 1,
          successCount: 44,
        },
      };

      return Promise.resolve(new Response(JSON.stringify({ success: true, data }), { status: 200 }));
    }));
  });

  test("renders page controls and loads the selected log page", async () => {
    render(<ApiOperationLogsClient />);

    expect(await screen.findByText("/api/admin/posts")).toBeInTheDocument();
    expect(screen.getByText("显示第 1 到 40 条，共 45 条记录")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/admin/logs?range=7&limit=40&page=1");

    fireEvent.click(screen.getByRole("button", { name: "下一页" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/admin/logs?range=7&limit=40&page=2");
    });
    expect(await screen.findByText("/api/admin/comments")).toBeInTheDocument();
    expect(screen.getByText("显示第 41 到 45 条，共 45 条记录")).toBeInTheDocument();
  });

  test("列表请求失败时展示兜底中文错误文案", async () => {
    // 全量置 undefined 强制冷启动：() => true 会留下“新鲜”的 truthy 缓存，挂载后不重取。
    await clearSwrCache(() => undefined, undefined, { revalidate: false });
    // SWR 在请求完成后按 dedupingInterval（默认 2000ms）才删除 FETCH 并发标记；
    // 前一用例的标记未过期会让本用例挂载被判定为“已有进行中请求”而跳过 fetch。
    await new Promise((resolve) => setTimeout(resolve, 2100));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 })),
    );

    render(<ApiOperationLogsClient />);

    expect(await screen.findByText("服务器内部错误，请稍后重试")).toBeInTheDocument();
  });
});
