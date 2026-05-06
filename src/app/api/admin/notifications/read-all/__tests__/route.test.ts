import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdminSession: mocks.requireAdminSession,
}));

vi.mock("@/lib/notifications", () => ({
  markAllNotificationsRead: mocks.markAllNotificationsRead,
}));

describe("admin notifications read-all route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin-1", role: "ADMIN" } });
    mocks.markAllNotificationsRead.mockResolvedValue({ unreadCount: 0 });
  });

  test("marks all notifications as read for the current admin", async () => {
    const { POST } = await import("../route");
    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.markAllNotificationsRead).toHaveBeenCalledWith("admin-1");
    expect(payload).toEqual({ success: true, data: { unreadCount: 0 } });
  });
});
