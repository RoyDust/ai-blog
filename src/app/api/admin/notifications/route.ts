import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { ValidationError, toErrorResponse } from "@/lib/api-errors";
import {
  dismissNotifications,
  listAdminNotifications,
  markNotificationsRead,
  parseNotificationCategory,
} from "@/lib/notifications";

function parseNotificationIds(value: unknown) {
  if (!Array.isArray(value)) {
    throw new ValidationError("Notification IDs are required");
  }

  return value.filter((id): id is string => typeof id === "string" && id.trim().length > 0).map((id) => id.trim());
}

async function GETHandler(request: Request) {
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

async function PATCHHandler(request: Request) {
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

export const GET = withApiOperationLogging(GETHandler, { scope: 'admin', operation: 'admin.notifications.read', route: '/api/admin/notifications' });
export const PATCH = withApiOperationLogging(PATCHHandler, { scope: 'admin', operation: 'admin.notifications.update', route: '/api/admin/notifications' });
