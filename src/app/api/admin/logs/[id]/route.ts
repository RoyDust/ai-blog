import { NextResponse } from "next/server";

import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { getApiOperationLog } from "@/lib/api-operation-logs";
import { requireAdminSession } from "@/lib/api-auth";
import { NotFoundError, toErrorResponse } from "@/lib/api-errors";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function GETHandler(_: Request, context: RouteContext) {
  try {
    await requireAdminSession();

    const { id } = await context.params;
    const log = await getApiOperationLog(id);
    if (!log) {
      throw new NotFoundError("API operation log not found");
    }

    return NextResponse.json({ success: true, data: log });
  } catch (error) {
    return toErrorResponse(error, "API operation log unavailable");
  }
}

export const GET = withApiOperationLogging(GETHandler, {
  scope: "admin",
  operation: "admin.logs.byId.read",
  route: "/api/admin/logs/[id]",
});
