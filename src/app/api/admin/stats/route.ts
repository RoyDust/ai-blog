import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { toErrorResponse } from "@/lib/api-errors";
import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { getDashboardStats } from "@/lib/admin-stats";

async function GETHandler(request: Request) {
  try {
    await requireAdminSession();

    const { searchParams } = new URL(request.url);
    const data = await getDashboardStats(searchParams.get("range"));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return toErrorResponse(error, "Admin stats unavailable");
  }
}

export const GET = withApiOperationLogging(GETHandler, {
  scope: "admin",
  operation: "admin.stats.read",
  route: "/api/admin/stats",
});
