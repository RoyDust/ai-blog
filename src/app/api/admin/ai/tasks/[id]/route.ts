import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { getAiTaskDetail } from "@/lib/ai-tasks";
import { toErrorResponse } from "@/lib/api-errors";

async function GETHandler(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminSession();

    const { id } = await params;
    const task = await getAiTaskDetail(id);

    return NextResponse.json({ success: true, data: task });
  } catch (error) {
    return toErrorResponse(error, "AI task detail failed");
  }
}

export const GET = withApiOperationLogging(GETHandler, { scope: 'admin', operation: 'admin.ai.tasks.byId.read', route: '/api/admin/ai/tasks/[id]' });
