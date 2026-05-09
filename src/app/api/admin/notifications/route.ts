import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { ValidationError, toErrorResponse } from "@/lib/api-errors";
import {
  dismissNotifications,
  listAdminNotifications,
  markNotificationsRead,
  parseNotificationCategory,
} from "@/lib/notifications";

/**
 * 解析 PATCH 请求中的通知 id 列表。
 */
function parseNotificationIds(value: unknown) {
  if (!Array.isArray(value)) {
    throw new ValidationError("Notification IDs are required");
  }

  return value.filter((id): id is string => typeof id === "string" && id.trim().length > 0).map((id) => id.trim());
}

/**
 * 查询当前管理员的通知列表。
 *
 * 支持未读过滤、业务分类过滤和游标分页，同时返回全局未读数。
 */
export async function GET(request: Request) {
  try {
    const session = await requireAdminSession();
    const { searchParams } = new URL(request.url);
    const data = await listAdminNotifications({
      userId: session.user.id,
      cursor: searchParams.get("cursor"),
      limit: searchParams.get("limit"),
      unreadOnly: searchParams.get("status") === "unread",
      category: parseNotificationCategory(searchParams.get("category")),
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return toErrorResponse(error, "Notification list failed");
  }
}

/**
 * 更新当前管理员的通知收件状态。
 *
 * action=read 标记已读；action=dismiss 软隐藏通知，不删除原始通知记录。
 */
export async function PATCH(request: Request) {
  try {
    const session = await requireAdminSession();
    const body = (await request.json().catch(() => ({}))) as { action?: unknown; ids?: unknown };
    const ids = parseNotificationIds(body.ids);

    if (body.action === "read") {
      const data = await markNotificationsRead(session.user.id, ids);
      return NextResponse.json({ success: true, data });
    }

    if (body.action === "dismiss") {
      const data = await dismissNotifications(session.user.id, ids);
      return NextResponse.json({ success: true, data });
    }

    throw new ValidationError("Invalid notification action");
  } catch (error) {
    return toErrorResponse(error, "Notification update failed");
  }
}
