import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { toErrorResponse } from "@/lib/api-errors";
import { markAllNotificationsRead } from "@/lib/notifications";

async function POSTHandler() {
  try {
    const session = await requireAdminSession();
    const data = await markAllNotificationsRead(session.user.id);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return toErrorResponse(error, "Notification read-all failed");
  }
}

export const POST = withApiOperationLogging(POSTHandler, { scope: 'admin', operation: 'admin.notifications.readall.create', route: '/api/admin/notifications/read-all' });
