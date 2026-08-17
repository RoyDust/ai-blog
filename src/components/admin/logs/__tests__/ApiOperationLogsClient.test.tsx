import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { mutate as clearSwrCache, SWRConfig } from "swr";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const toastSuccessMock = vi.hoisted(() => vi.fn());
const toastErrorMock = vi.hoisted(() => vi.fn());

vi.mock("sonner", () => ({
  toast: {
    success: toastSuccessMock,
    error: toastErrorMock,
  },
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

function logsPayload(isSecondPage = false) {
  return {
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
}

function renderLogsClient() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <ApiOperationLogsClient />
    </SWRConfig>,
  );
}

describe("ApiOperationLogsClient", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearSwrCache(() => true, undefined, { revalidate: false });
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      const isSecondPage = url.includes("page=2");
      return Promise.resolve(new Response(JSON.stringify({ success: true, data: logsPayload(isSecondPage) }), { status: 200 }));
    }));
  });

  test("renders page controls and loads the selected log page", async () => {
    renderLogsClient();

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
    // 每个用例经 renderLogsClient 使用独立 Map provider（dedupingInterval=0），无需真实等待
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 })),
    );

    renderLogsClient();

    expect(await screen.findByText("服务器内部错误，请稍后重试")).toBeInTheDocument();
  });

  test("清理旧日志需先确认：确认后调用 purge 接口并提示成功", async () => {
    renderLogsClient();

    await screen.findByText("/api/admin/posts");
    fireEvent.click(screen.getByRole("button", { name: "清理旧日志" }));

    expect(screen.getByText("将删除 30 天前的操作日志记录，删除后不可恢复。")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "确认清理" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/admin/logs/purge",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ retentionDays: 30 }),
        }),
      );
      expect(toastSuccessMock).toHaveBeenCalledWith("已清理 30 天前的操作日志");
    });
  });

  test("清理旧日志：取消确认时不调用 purge 接口", async () => {
    renderLogsClient();

    await screen.findByText("/api/admin/posts");
    fireEvent.click(screen.getByRole("button", { name: "清理旧日志" }));
    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(fetch).not.toHaveBeenCalledWith(
      "/api/admin/logs/purge",
      expect.objectContaining({ method: "POST" }),
    );
  });

  test("清理旧日志失败时通过 toast.error 反馈", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (init?.method === "POST" && url.includes("/logs/purge")) {
          return Promise.resolve(new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 }));
        }
        return Promise.resolve(new Response(JSON.stringify({ success: true, data: logsPayload() }), { status: 200 }));
      }),
    );

    renderLogsClient();

    await screen.findByText("/api/admin/posts");
    fireEvent.click(screen.getByRole("button", { name: "清理旧日志" }));
    fireEvent.click(screen.getByRole("button", { name: "确认清理" }));

    await waitFor(() => {
      expect(toastErrorMock).toHaveBeenCalledWith("服务器内部错误，请稍后重试");
    });
  });
});
