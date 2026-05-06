import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  listAdminNotifications: vi.fn(),
  markNotificationsRead: vi.fn(),
  dismissNotifications: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdminSession: mocks.requireAdminSession,
}));

vi.mock("@/lib/notifications", () => ({
  listAdminNotifications: mocks.listAdminNotifications,
  markNotificationsRead: mocks.markNotificationsRead,
  dismissNotifications: mocks.dismissNotifications,
  parseNotificationCategory: (value: string | null) => value,
}));

describe("admin notifications route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    mocks.listAdminNotifications.mockResolvedValue({ items: [], unreadCount: 0, nextCursor: null });
    mocks.markNotificationsRead.mockResolvedValue({ unreadCount: 0 });
    mocks.dismissNotifications.mockResolvedValue({ unreadCount: 0 });
  });

  test("returns filtered notifications for admins", async () => {
    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/admin/notifications?status=unread&category=ai&limit=8"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.listAdminNotifications).toHaveBeenCalledWith({
      userId: "admin-1",
      cursor: null,
      limit: "8",
      unreadOnly: true,
      category: "ai",
    });
    expect(payload).toEqual({ success: true, data: { items: [], unreadCount: 0, nextCursor: null } });
  });

  test("marks selected notifications as read", async () => {
    const { PATCH } = await import("../route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read", ids: ["notification-1"] }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.markNotificationsRead).toHaveBeenCalledWith("admin-1", ["notification-1"]);
  });

  test("dismisses selected notifications", async () => {
    const { PATCH } = await import("../route");
    const response = await PATCH(
      new Request("http://localhost/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "dismiss", ids: ["notification-1"] }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.dismissNotifications).toHaveBeenCalledWith("admin-1", ["notification-1"]);
  });

  test("rejects anonymous requests", async () => {
    const { UnauthorizedError } = await import("@/lib/api-errors");
    mocks.requireAdminSession.mockRejectedValueOnce(new UnauthorizedError());

    const { GET } = await import("../route");
    const response = await GET(new Request("http://localhost/api/admin/notifications"));

    expect(response.status).toBe(401);
  });
});
