import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/api-auth";
import { toErrorResponse } from "@/lib/api-errors";
import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { revalidateAiTaskContent } from "@/lib/ai-task-cache-recovery";

async function POSTHandler(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminSession();
    const { id } = await params;
    const report = await revalidateAiTaskContent(id);
    return NextResponse.json({ success: true, data: report }, { status: report.complete ? 200 : 207 });
  } catch (error) {
    return toErrorResponse(error, "AI task cache revalidation failed");
  }
}
export const POST = withApiOperationLogging(POSTHandler, { scope: "admin", operation: "admin.ai.tasks.revalidate", route: "/api/admin/ai/tasks/[id]/revalidate" });
