import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { createAiBatchTask, getAiBatchTaskSnapshot, MAX_OBSERVED_AI_TASKS, resumeAiBatchTasks } from "@/lib/ai-batch-jobs";
import { toErrorResponse, ValidationError } from "@/lib/api-errors";

type Body = {
  action?: string;
  resume?: boolean;
  taskId?: string;
  taskIds?: string[];
  postIds?: string[];
  actions?: string[];
  mode?: string;
  apply?: boolean;
  modelId?: string;
};

async function parseOptionalJsonObject(request: Request): Promise<Body> {
  const raw = await request.text();
  if (!raw.trim()) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ValidationError("Invalid JSON body");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ValidationError("Invalid JSON body");
  }

  return parsed as Body;
}

function normalizeResumeIds(request: Request, body: Body): string[] {
  const { searchParams } = new URL(request.url);
  const rawIds: string[] = [
    ...searchParams.getAll("taskId"),
    ...(searchParams.get("taskIds")?.split(",") ?? []),
  ];

  if (body.taskId !== undefined && body.taskId !== null) {
    if (typeof body.taskId !== "string") {
      throw new ValidationError("Invalid taskId");
    }
    rawIds.push(body.taskId);
  }

  if (body.taskIds !== undefined && body.taskIds !== null) {
    if (!Array.isArray(body.taskIds) || body.taskIds.some((item) => typeof item !== "string")) {
      throw new ValidationError("taskIds must be an array of strings");
    }
    rawIds.push(...body.taskIds);
  }

  const maxLimit = MAX_OBSERVED_AI_TASKS ?? 50;
  const trimmed = rawIds.map((id) => id.trim()).filter(Boolean);
  if (trimmed.length > maxLimit || trimmed.some((id) => id.length > 128)) {
    throw new ValidationError(`最多恢复 ${maxLimit} 个 AI 任务`);
  }

  return [...new Set(trimmed)];
}

async function POSTHandler(request: Request) {
  try {
    const session = await requireAdminSession();
    const { searchParams } = new URL(request.url);
    const body = await parseOptionalJsonObject(request);

    if (body.action === "resume" || body.resume === true || searchParams.get("resume") === "1") {
      const ids = normalizeResumeIds(request, body);
      let resumed = 0;
      if (ids.length > 0) {
        for (const id of ids) {
          resumed += await resumeAiBatchTasks(id);
        }
      } else {
        resumed = await resumeAiBatchTasks();
      }
      return NextResponse.json({ success: true, data: { resumed } }, { status: 202 });
    }

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
    const includeActive = searchParams.get("includeActive") === "1";
    const snapshot = includeActive
      ? await getAiBatchTaskSnapshot(taskIds, { includeActive: true })
      : await getAiBatchTaskSnapshot(taskIds);
    return NextResponse.json({ success: true, data: snapshot });
  } catch (error) {
    return toErrorResponse(error, "AI batch snapshot failed");
  }
}

export const POST = withApiOperationLogging(POSTHandler, { scope: 'admin', operation: 'admin.ai.batch.create', route: '/api/admin/ai/batch' });
export const GET = withApiOperationLogging(GETHandler, { scope: 'admin', operation: 'admin.ai.batch.read', route: '/api/admin/ai/batch' });
