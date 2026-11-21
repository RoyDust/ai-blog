import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
});
