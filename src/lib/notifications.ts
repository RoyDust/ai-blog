import type { Prisma } from "@prisma/client";

import { ValidationError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";

export const NOTIFICATION_TYPES = {
  commentCreated: "COMMENT_CREATED",
  commentPending: "COMMENT_PENDING",
  commentReply: "COMMENT_REPLY",
  aiTaskSucceeded: "AI_TASK_SUCCEEDED",
  aiTaskFailed: "AI_TASK_FAILED",
  aiTaskPartialFailed: "AI_TASK_PARTIAL_FAILED",
  aiNewsSucceeded: "AI_NEWS_SUCCEEDED",
  aiNewsFailed: "AI_NEWS_FAILED",
  systemWarning: "SYSTEM_WARNING",
} as const;

export const NOTIFICATION_SEVERITIES = {
  info: "INFO",
  success: "SUCCESS",
  warning: "WARNING",
  error: "ERROR",
} as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];
export type NotificationSeverity = (typeof NOTIFICATION_SEVERITIES)[keyof typeof NOTIFICATION_SEVERITIES];
export type NotificationCategory = "comment" | "ai" | "system";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type CreateNotificationInput = {
  type: NotificationType;
  severity?: NotificationSeverity;
  title: string;
  body?: string | null;
  actionUrl?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  dedupeKey?: string | null;
  metadata?: JsonValue;
};

export type NotificationListItem = {
  id: string;
  receiptId: string;
  type: string;
  severity: string;
  title: string;
  body: string | null;
  actionUrl: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  readAt: Date | null;
  dismissedAt: Date | null;
};

const CATEGORY_TYPES: Record<NotificationCategory, NotificationType[]> = {
  comment: [NOTIFICATION_TYPES.commentCreated, NOTIFICATION_TYPES.commentPending, NOTIFICATION_TYPES.commentReply],
  ai: [
    NOTIFICATION_TYPES.aiTaskSucceeded,
    NOTIFICATION_TYPES.aiTaskFailed,
    NOTIFICATION_TYPES.aiTaskPartialFailed,
    NOTIFICATION_TYPES.aiNewsSucceeded,
    NOTIFICATION_TYPES.aiNewsFailed,
  ],
  system: [NOTIFICATION_TYPES.systemWarning],
};

function toJson(value: JsonValue | undefined) {
  return value === undefined ? undefined : (value as unknown as Prisma.InputJsonValue);
}

function normalizeLimit(value: unknown, fallback = 8) {
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit <= 0) {
    return fallback;
  }

  return Math.min(limit, 50);
}

function notificationCreateData(input: CreateNotificationInput) {
  return {
    type: input.type,
    severity: input.severity ?? NOTIFICATION_SEVERITIES.info,
    title: input.title,
    body: input.body ?? null,
    actionUrl: input.actionUrl ?? null,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    dedupeKey: input.dedupeKey ?? null,
    metadata: toJson(input.metadata),
  };
}

async function getAdminRecipientIds() {
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  return admins.map((admin) => admin.id);
}

async function ensureRecipients(notificationId: string, userIds: string[]) {
  if (userIds.length === 0) {
    return;
  }

  await prisma.notificationRecipient.createMany({
    data: userIds.map((userId) => ({ notificationId, userId })),
    skipDuplicates: true,
  });
}

export async function createAdminNotification(input: CreateNotificationInput) {
  const data = notificationCreateData(input);
  const notification = input.dedupeKey
    ? await prisma.notification.upsert({
        where: { dedupeKey: input.dedupeKey },
        create: data,
        update: {
          severity: data.severity,
          title: data.title,
          body: data.body,
          actionUrl: data.actionUrl,
          entityType: data.entityType,
          entityId: data.entityId,
          metadata: data.metadata,
        },
      })
    : await prisma.notification.create({ data });

  await ensureRecipients(notification.id, await getAdminRecipientIds());

  return notification;
}

export async function createUserNotification(userId: string, input: CreateNotificationInput) {
  const data = notificationCreateData(input);
  const notification = input.dedupeKey
    ? await prisma.notification.upsert({
        where: { dedupeKey: input.dedupeKey },
        create: data,
        update: {
          severity: data.severity,
          title: data.title,
          body: data.body,
          actionUrl: data.actionUrl,
          entityType: data.entityType,
          entityId: data.entityId,
          metadata: data.metadata,
        },
      })
    : await prisma.notification.create({ data });

  await ensureRecipients(notification.id, [userId]);

  return notification;
}

export async function listAdminNotifications({
  userId,
  cursor,
  limit,
  unreadOnly = false,
  category,
}: {
  userId: string;
  cursor?: string | null;
  limit?: unknown;
  unreadOnly?: boolean;
  category?: NotificationCategory | null;
}) {
  const pageSize = normalizeLimit(limit);
  const notificationTypeFilter = category ? CATEGORY_TYPES[category] : null;
  const where = {
    userId,
    dismissedAt: null,
    ...(unreadOnly ? { readAt: null } : {}),
    ...(notificationTypeFilter ? { notification: { type: { in: notificationTypeFilter } } } : {}),
  };

  const [unreadCount, rows] = await Promise.all([
    prisma.notificationRecipient.count({
      where: { userId, readAt: null, dismissedAt: null },
    }),
    prisma.notificationRecipient.findMany({
      where,
      include: { notification: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: pageSize + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
  ]);

  const hasMore = rows.length > pageSize;
  const visibleRows = hasMore ? rows.slice(0, pageSize) : rows;

  return {
    items: visibleRows.map((row): NotificationListItem => ({
      id: row.notification.id,
      receiptId: row.id,
      type: row.notification.type,
      severity: row.notification.severity,
      title: row.notification.title,
      body: row.notification.body,
      actionUrl: row.notification.actionUrl,
      entityType: row.notification.entityType,
      entityId: row.notification.entityId,
      metadata: row.notification.metadata,
      createdAt: row.notification.createdAt,
      readAt: row.readAt,
      dismissedAt: row.dismissedAt,
    })),
    unreadCount,
    nextCursor: hasMore ? visibleRows.at(-1)?.id ?? null : null,
  };
}

export async function getUnreadNotificationCount(userId: string) {
  return prisma.notificationRecipient.count({
    where: { userId, readAt: null, dismissedAt: null },
  });
}

export async function markNotificationsRead(userId: string, notificationIds: string[]) {
  if (notificationIds.length === 0) {
    throw new ValidationError("Notification IDs are required");
  }

  await prisma.notificationRecipient.updateMany({
    where: {
      userId,
      notificationId: { in: notificationIds },
      dismissedAt: null,
      readAt: null,
    },
    data: { readAt: new Date() },
  });

  return { unreadCount: await getUnreadNotificationCount(userId) };
}

export async function markAllNotificationsRead(userId: string) {
  await prisma.notificationRecipient.updateMany({
    where: { userId, readAt: null, dismissedAt: null },
    data: { readAt: new Date() },
  });

  return { unreadCount: 0 };
}

export async function dismissNotifications(userId: string, notificationIds: string[]) {
  if (notificationIds.length === 0) {
    throw new ValidationError("Notification IDs are required");
  }

  await prisma.notificationRecipient.updateMany({
    where: {
      userId,
      notificationId: { in: notificationIds },
      dismissedAt: null,
    },
    data: { dismissedAt: new Date() },
  });

  return { unreadCount: await getUnreadNotificationCount(userId) };
}

export function parseNotificationCategory(value: string | null): NotificationCategory | null {
  if (!value) return null;
  if (value === "comment" || value === "ai" || value === "system") return value;
  throw new ValidationError("Invalid notification category");
}
