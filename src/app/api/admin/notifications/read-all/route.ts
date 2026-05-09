import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { toErrorResponse } from "@/lib/api-errors";
import { markAllNotificationsRead } from "@/lib/notifications";

/**
 * 将当前管理员的所有通知标记为已读。
 */
export async function POST() {
  try {
    const session = await requireAdminSession();
    const data = await markAllNotificationsRead(session.user.id);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return toErrorResponse(error, "Notification read-all failed");
  }
}
