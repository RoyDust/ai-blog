import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

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
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(fetch).toHaveBeenCalledWith("/api/admin/logs?range=7&limit=40&page=1", { cache: "no-store" });

    fireEvent.click(screen.getByRole("button", { name: "下一页" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/admin/logs?range=7&limit=40&page=2", { cache: "no-store" });
    });
    expect(await screen.findByText("/api/admin/comments")).toBeInTheDocument();
    expect(screen.getByText("显示第 41 到 45 条，共 45 条记录")).toBeInTheDocument();
  });
});
