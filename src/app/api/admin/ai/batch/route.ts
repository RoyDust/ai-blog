import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { createAiBatchTask, getAiBatchTaskSnapshot, resumeAiBatchTasks } from "@/lib/ai-batch-jobs";
import { toErrorResponse } from "@/lib/api-errors";

type Body = {
  postIds?: string[];
  actions?: string[];
  mode?: string;
  apply?: boolean;
  modelId?: string;
};

async function POSTHandler(request: Request) {
  try {
    const session = await requireAdminSession();
    const body = (await request.json()) as Body;
    const task = await createAiBatchTask({
      postIds: body.postIds,
      actions: body.actions,
      mode: body.mode,
      apply: body.apply,
      modelId: body.modelId,
      createdById: session.user.id,
    });

    return NextResponse.json({ success: true, data: task }, { status: task.items.length > 0 ? 202 : 200 });
  } catch (error) {
    return toErrorResponse(error, "AI batch task failed");
  }
}

async function GETHandler(request: Request) {
  try {
    await requireAdminSession();
    const { searchParams } = new URL(request.url);

    const taskIds = [...searchParams.getAll("taskId"), ...(searchParams.get("taskIds")?.split(",") ?? [])];
    // Validate the observed set before any legacy recovery side effect.
    const snapshot = await getAiBatchTaskSnapshot(taskIds);
    if (searchParams.get("resume") === "1") {
      const ids = [...new Set(taskIds.map((id) => id.trim()).filter(Boolean))];
      if (ids.length) {
        for (const id of ids) await resumeAiBatchTasks(id);
      } else {
        await resumeAiBatchTasks();
      }
    }
    return NextResponse.json({ success: true, data: snapshot });
  } catch (error) {
    return toErrorResponse(error, "AI batch resume failed");
  }
}

export const POST = withApiOperationLogging(POSTHandler, { scope: 'admin', operation: 'admin.ai.batch.create', route: '/api/admin/ai/batch' });
export const GET = withApiOperationLogging(GETHandler, { scope: 'admin', operation: 'admin.ai.batch.read', route: '/api/admin/ai/batch' });
