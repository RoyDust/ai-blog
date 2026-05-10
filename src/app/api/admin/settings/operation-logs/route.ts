import { NextResponse } from "next/server";

import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import {
  getApiOperationLogSettingsSummary,
  updateApiOperationLogMaxStorageBytes,
} from "@/lib/api-operation-log-settings";
import { requireAdminSession } from "@/lib/api-auth";
import { toErrorResponse } from "@/lib/api-errors";

function toPayload(summary: Awaited<ReturnType<typeof getApiOperationLogSettingsSummary>>, deletedCount = 0) {
  return {
    ...summary,
    deletedCount,
  };
}

async function GETHandler() {
  try {
    await requireAdminSession();
    const summary = await getApiOperationLogSettingsSummary();

    return NextResponse.json({ success: true, data: toPayload(summary) });
  } catch (error) {
    return toErrorResponse(error, "Operation log settings unavailable");
  }
}

async function PATCHHandler(request: Request) {
  try {
    await requireAdminSession();
    const body = (await request.json().catch(() => ({}))) as { maxStorageMb?: unknown; maxStorageBytes?: unknown };
    const nextLimit =
      body.maxStorageBytes === undefined
        ? typeof body.maxStorageMb === "number" || typeof body.maxStorageMb === "string"
          ? `${body.maxStorageMb}mb`
          : body.maxStorageMb
        : body.maxStorageBytes;
    const result = await updateApiOperationLogMaxStorageBytes(nextLimit);
    const summary = await getApiOperationLogSettingsSummary();

    return NextResponse.json({ success: true, data: toPayload(summary, result.deletedCount) });
  } catch (error) {
    return toErrorResponse(error, "Operation log settings update failed");
  }
}

export const GET = withApiOperationLogging(GETHandler, {
  scope: "admin",
  operation: "admin.settings.operationLogs.read",
  route: "/api/admin/settings/operation-logs",
});

export const PATCH = withApiOperationLogging(PATCHHandler, {
  scope: "admin",
  operation: "admin.settings.operationLogs.update",
  route: "/api/admin/settings/operation-logs",
});
