import { NextResponse } from "next/server";

import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { purgeApiOperationLogs } from "@/lib/api-operation-logs";
import { requireAdminSession } from "@/lib/api-auth";
import { toErrorResponse } from "@/lib/api-errors";

async function POSTHandler(request: Request) {
  try {
    await requireAdminSession();

    const body = (await request.json().catch(() => ({}))) as { retentionDays?: unknown };
    const data = await purgeApiOperationLogs(body.retentionDays);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return toErrorResponse(error, "API operation log purge failed");
  }
}

export const POST = withApiOperationLogging(POSTHandler, {
  scope: "admin",
  operation: "admin.logs.purge.create",
  route: "/api/admin/logs/purge",
});
