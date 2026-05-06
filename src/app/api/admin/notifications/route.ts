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
