import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("NotificationBell", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
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
  });

  test("shows real unread notifications and supports marking all as read", async () => {
    const { NotificationBell } = await import("../NotificationBell");
    render(<NotificationBell />);

    const trigger = await screen.findByRole("button", { name: "通知，1 条未读" });
    expect(trigger).toBeInTheDocument();

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(await screen.findByText("AI 任务失败")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /全部已读/ }));

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/admin/notifications/read-all", { method: "POST" }));
    expect(screen.getAllByText("全部已读").length).toBeGreaterThan(0);
  });
});
