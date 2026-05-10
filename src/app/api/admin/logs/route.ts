import { NextResponse } from "next/server";

import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { listApiOperationLogs } from "@/lib/api-operation-logs";
import { requireAdminSession } from "@/lib/api-auth";
import { toErrorResponse } from "@/lib/api-errors";

async function GETHandler(request: Request) {
  try {
    await requireAdminSession();

    const { searchParams } = new URL(request.url);
    const data = await listApiOperationLogs({
      cursor: searchParams.get("cursor"),
      limit: searchParams.get("limit"),
      range: searchParams.get("range"),
      from: searchParams.get("from"),
      to: searchParams.get("to"),
      method: searchParams.get("method"),
      status: searchParams.get("status"),
      success: searchParams.get("success"),
      scope: searchParams.get("scope"),
      path: searchParams.get("path"),
      actor: searchParams.get("actor"),
      requestId: searchParams.get("requestId"),
      includeSelf: searchParams.get("includeSelf") === "1",
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return toErrorResponse(error, "API operation logs unavailable");
  }
}

export const GET = withApiOperationLogging(GETHandler, {
  scope: "admin",
  operation: "admin.logs.read",
  route: "/api/admin/logs",
});
