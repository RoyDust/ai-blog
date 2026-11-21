import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { mutate as clearSwrCache, SWRConfig } from "swr";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import { NotificationBell } from "../NotificationBell";

function renderBell() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0, focusThrottleInterval: 0 }}>
      <NotificationBell />
    </SWRConfig>,
  );
}

describe("NotificationBell", () => {
  beforeEach(async () => {
    await clearSwrCache(() => true, undefined, { revalidate: false });
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("shows real unread notifications and supports marking all as read", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/admin/notifications/read-all" && init?.method === "POST") {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: { unreadCount: 0 } }),
          });
        }

        if (url === "/api/admin/notifications" && init?.method === "PATCH") {
          return Promise.resolve({
            ok: true,
            json: async () => ({ success: true, data: { unreadCount: 0 } }),
          });
        }

        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            data: {
              unreadCount: 1,
              nextCursor: null,
              items: [
                {
                  id: "notification-1",
                  receiptId: "receipt-1",
                  type: "AI_TASK_FAILED",
                  severity: "ERROR",
                  title: "AI 任务失败",
                  body: "timeout",
                  actionUrl: "/admin/ai/tasks/task-1",
                  createdAt: "2026-05-07T08:00:00.000Z",
                  readAt: null,
                },
              ],
            },
          }),
        });
      }),
    );

    renderBell();

    const trigger = await screen.findByRole("button", { name: "通知，1 条未读" });
    expect(trigger).toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(await screen.findByText("AI 任务失败")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "AI 任务失败，未读" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /全部已读/ }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/admin/notifications/read-all",
        expect.objectContaining({ method: "POST" }),
      ),
    );
    expect(screen.getAllByText("全部已读").length).toBeGreaterThan(0);
  });

  test("automatically clears error banner and renders items on next successful SWR fetch", async () => {
    let shouldFail = true;
    const fetchMock = vi.fn(async () => {
      if (shouldFail) {
        throw new TypeError("Failed to fetch");
      }

      return {
        ok: true,
        json: async () => ({
          success: true,
          data: {
            unreadCount: 1,
            nextCursor: null,
            items: [
              {
                id: "notification-recovered",
                receiptId: "receipt-recovered",
                type: "COMMENT_CREATED",
                severity: "INFO",
                title: "收到新评论",
                body: "恢复正常",
                actionUrl: "/admin/comments",
                createdAt: "2026-05-07T08:05:00.000Z",
                readAt: null,
              },
            ],
          },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    renderBell();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    const trigger = screen.getByRole("button", { name: "通知" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    expect(await screen.findByRole("alert")).toHaveTextContent("网络异常，请检查网络连接后重试");

    shouldFail = false;
    fireEvent(window, new Event("focus"));

    expect(await screen.findByText("收到新评论")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "收到新评论，未读" })).toBeInTheDocument();
    expect(screen.getByText("1 条未读")).toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-label", "通知，1 条未读");
  });

  test("continues 30s backoff retries beyond global errorRetryCount=2 and recovers without window focus, while skipping 403", async () => {
    vi.useFakeTimers();

    let attempt = 0;
    const fetchMock = vi.fn(async () => {
      attempt += 1;
      if (attempt <= 4) {
        return {
          ok: false,
          status: 503,
          json: async () => ({ error: "Service unavailable" }),
        };
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          data: {
            unreadCount: 2,
            nextCursor: null,
            items: [
              {
                id: "notification-auto-recovered",
                receiptId: "receipt-auto-recovered",
                type: "AI_NEWS_SUCCEEDED",
                severity: "SUCCESS",
                title: "长时故障后自动恢复",
                body: "无需窗口焦点",
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

    render(
      <SWRConfig
        value={{
          provider: () => new Map(),
          dedupingInterval: 0,
          errorRetryCount: 2,
          shouldRetryOnError: true,
        }}
      >
        <NotificationBell />
      </SWRConfig>,
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // 连续推进 4 个 30s 周期（跨越默认 errorRetryCount=2 限制），期间不触发 window focus
    for (let step = 0; step < 4; step += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_000);
      });
    }

    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(5);
    expect(screen.getByRole("button", { name: "通知，2 条未读" })).toBeInTheDocument();

    cleanup();

    // 403 权限失败时不安排后台重试风暴
    const forbiddenFetchMock = vi.fn(async () => ({
      ok: false,
      status: 403,
      json: async () => ({ error: "Forbidden" }),
    }));
    vi.stubGlobal("fetch", forbiddenFetchMock);

    render(
      <SWRConfig
        value={{
          provider: () => new Map(),
          dedupingInterval: 0,
          refreshInterval: 0,
          errorRetryCount: 2,
          shouldRetryOnError: true,
        }}
      >
        <NotificationBell />
      </SWRConfig>,
    );

    await act(async () => {
      await Promise.resolve();
    });
    const callsAfterInitial403 = forbiddenFetchMock.mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(90_000);
    });
    expect(forbiddenFetchMock).toHaveBeenCalledTimes(callsAfterInitial403);
  });
});
