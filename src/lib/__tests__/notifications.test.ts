import { beforeEach, describe, expect, test, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  userFindMany: vi.fn(),
  notificationCreate: vi.fn(),
  notificationUpsert: vi.fn(),
  recipientCreateMany: vi.fn(),
  recipientCount: vi.fn(),
  recipientFindMany: vi.fn(),
  recipientUpdateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findMany: prismaMocks.userFindMany },
    notification: {
      create: prismaMocks.notificationCreate,
      upsert: prismaMocks.notificationUpsert,
    },
    notificationRecipient: {
      createMany: prismaMocks.recipientCreateMany,
      count: prismaMocks.recipientCount,
      findMany: prismaMocks.recipientFindMany,
      updateMany: prismaMocks.recipientUpdateMany,
    },
  },
}));

describe("notification service", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    prismaMocks.userFindMany.mockResolvedValue([{ id: "admin-1" }, { id: "admin-2" }]);
    prismaMocks.notificationCreate.mockResolvedValue({ id: "notification-1" });
    prismaMocks.notificationUpsert.mockResolvedValue({ id: "notification-1" });
    prismaMocks.recipientCreateMany.mockResolvedValue({ count: 2 });
    prismaMocks.recipientCount.mockResolvedValue(0);
    prismaMocks.recipientFindMany.mockResolvedValue([]);
    prismaMocks.recipientUpdateMany.mockResolvedValue({ count: 1 });
  });

  test("creates an admin notification for all current admins with a dedupe key", async () => {
    const { createAdminNotification, NOTIFICATION_TYPES } = await import("../notifications");

    await createAdminNotification({
      type: NOTIFICATION_TYPES.commentCreated,
      title: "有新评论",
      dedupeKey: "comment:comment-1:created",
      metadata: { commentId: "comment-1" },
    });

    expect(prismaMocks.notificationUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { dedupeKey: "comment:comment-1:created" },
        create: expect.objectContaining({
          type: "COMMENT_CREATED",
          title: "有新评论",
          dedupeKey: "comment:comment-1:created",
        }),
      }),
    );
    expect(prismaMocks.recipientCreateMany).toHaveBeenCalledWith({
      data: [
        { notificationId: "notification-1", userId: "admin-1" },
        { notificationId: "notification-1", userId: "admin-2" },
      ],
      skipDuplicates: true,
    });
  });

  test("lists notifications with unread counts and flattened receipt state", async () => {
    const createdAt = new Date("2026-05-07T08:00:00Z");
    prismaMocks.recipientCount.mockResolvedValueOnce(2);
    prismaMocks.recipientFindMany.mockResolvedValueOnce([
      {
        id: "receipt-1",
        readAt: null,
        dismissedAt: null,
        notification: {
          id: "notification-1",
          type: "AI_TASK_FAILED",
          severity: "ERROR",
          title: "AI 任务失败",
          body: "timeout",
          actionUrl: "/admin/ai/tasks/task-1",
          entityType: "aiTask",
          entityId: "task-1",
          metadata: null,
          createdAt,
        },
      },
    ]);

    const { listAdminNotifications } = await import("../notifications");
    const result = await listAdminNotifications({ userId: "admin-1", unreadOnly: true, category: "ai" });

    expect(prismaMocks.recipientFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        userId: "admin-1",
        readAt: null,
        notification: { type: { in: expect.arrayContaining(["AI_TASK_FAILED"]) } },
      }),
    }));
    expect(result).toEqual({
      unreadCount: 2,
      nextCursor: null,
      items: [
        expect.objectContaining({
          id: "notification-1",
          receiptId: "receipt-1",
          readAt: null,
          createdAt,
        }),
      ],
    });
  });

  test("marks selected notifications as read for the current admin", async () => {
    prismaMocks.recipientCount.mockResolvedValueOnce(0);

    const { markNotificationsRead } = await import("../notifications");
    const result = await markNotificationsRead("admin-1", ["notification-1"]);

    expect(prismaMocks.recipientUpdateMany).toHaveBeenCalledWith({
      where: {
        userId: "admin-1",
        notificationId: { in: ["notification-1"] },
        dismissedAt: null,
        readAt: null,
      },
      data: { readAt: expect.any(Date) },
    });
    expect(result).toEqual({ unreadCount: 0 });
  });
});
