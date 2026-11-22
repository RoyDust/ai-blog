import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mutate as clearSwrCache, SWRConfig } from "swr";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import { NotificationCenterClient } from "../NotificationCenterClient";

function renderCenter() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, focusThrottleInterval: 0 }}>
      <NotificationCenterClient />
    </SWRConfig>,
  );
}

describe("NotificationCenterClient", () => {
  beforeEach(async () => {
    await clearSwrCache(() => true, undefined, { revalidate: false });
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("recovers automatically on next successful SWR revalidation after a transient failure", async () => {
    let shouldFail = true;
    const fetchMock = vi.fn(async () => {
      if (shouldFail) {
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: "Internal server error" }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            unreadCount: 1,
            nextCursor: null,
            items: [
              {
                id: "center-1",
                receiptId: "receipt-center-1",
                type: "AI_DAILY_READY",
                severity: "SUCCESS",
                title: "AI 日报已生成",
                body: "点击审阅今日草稿",
                actionUrl: "/admin/ai-news",
                createdAt: "2026-05-07T09:00:00.000Z",
                readAt: null,
              },
            ],
          },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    renderCenter();

    expect(await screen.findByRole("alert")).toHaveTextContent("服务器内部错误，请稍后重试");

    shouldFail = false;
    fireEvent(window, new Event("focus"));

    expect(await screen.findByText("AI 日报已生成")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  test("discards stale in-flight 'all' loadMore response after user switches filter to 'unread'", async () => {
    let resolveAllPage2!: (value: unknown) => void;
    const allPage2Promise = new Promise((resolve) => {
      resolveAllPage2 = resolve;
    });

    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/admin/notifications?limit=30") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              unreadCount: 1,
              nextCursor: "cursor-all-2",
              items: [
                {
                  id: "all-1",
                  receiptId: "r-all-1",
                  type: "COMMENT_CREATED",
                  severity: "INFO",
                  title: "全部列表第一页项",
                  body: null,
                  actionUrl: null,
                  createdAt: "2026-05-07T09:00:00.000Z",
                  readAt: "2026-05-07T09:01:00.000Z",
                },
              ],
            },
          }),
        });
      }

      if (url === "/api/admin/notifications?limit=30&cursor=cursor-all-2") {
        return allPage2Promise;
      }

      if (url === "/api/admin/notifications?limit=30&status=unread") {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            data: {
              unreadCount: 1,
              nextCursor: null,
              items: [
                {
                  id: "unread-only-1",
                  receiptId: "r-unread-1",
                  type: "AI_TASK_FAILED",
                  severity: "ERROR",
                  title: "仅未读筛选结果",
                  body: null,
                  actionUrl: null,
                  createdAt: "2026-05-07T09:05:00.000Z",
                  readAt: null,
                },
              ],
            },
          }),
        });
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    renderCenter();

    expect(await screen.findByText("全部列表第一页项")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "加载更多" }));

    // 分页请求尚在途中，用户切到“未读”筛选
    const filterGroup = screen.getByRole("group", { name: "通知筛选" });
    fireEvent.click(within(filterGroup).getByRole("button", { name: "未读" }));
    expect(await screen.findByText("仅未读筛选结果")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "加载更多" })).not.toBeInTheDocument();

    // 过期的“全部”第 2 页响应晚到，不应追加或覆盖 nextCursor
    resolveAllPage2({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: {
          unreadCount: 1,
          nextCursor: "cursor-all-3",
          items: [
            {
              id: "stale-all-2",
              receiptId: "r-stale-2",
              type: "COMMENT_CREATED",
              severity: "INFO",
              title: "过期的全部第二页已读通知",
              body: null,
              actionUrl: null,
              createdAt: "2026-05-07T08:00:00.000Z",
              readAt: "2026-05-07T08:01:00.000Z",
            },
          ],
        },
      }),
    });

    await waitFor(() => {
      expect(screen.getByText("仅未读筛选结果")).toBeInTheDocument();
    });
    expect(screen.queryByText("过期的全部第二页已读通知")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "加载更多" })).not.toBeInTheDocument();
  });
});
