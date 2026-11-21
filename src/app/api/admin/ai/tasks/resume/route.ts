import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { MAX_OBSERVED_AI_TASKS, resumeAiBatchTasks } from "@/lib/ai-batch-jobs";
import { toErrorResponse, ValidationError } from "@/lib/api-errors";
import { resumePostSummaryJobs } from "@/lib/post-summary-jobs";

type ResumeAiTasksBody = {
  taskId?: unknown;
  taskIds?: unknown;
  includeSummaryJobs?: unknown;
};

async function parseResumeBody(request: Request): Promise<ResumeAiTasksBody> {
  const raw = await request.text();
  if (!raw.trim()) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ValidationError("Invalid JSON payload");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ValidationError("Invalid resume payload");
  }

  return parsed as ResumeAiTasksBody;
}

function normalizeResumeTaskIds(request: Request, body: ResumeAiTasksBody): string[] {
  const { searchParams } = new URL(request.url);
  const collected: string[] = [
    ...searchParams.getAll("taskId"),
    ...(searchParams.get("taskIds")?.split(",") ?? []),
  ];

  if (body.taskId !== undefined && body.taskId !== null) {
    if (typeof body.taskId !== "string") {
      throw new ValidationError("Invalid taskId");
    }
    collected.push(body.taskId);
  }

  if (body.taskIds !== undefined && body.taskIds !== null) {
    if (!Array.isArray(body.taskIds) || body.taskIds.some((item) => typeof item !== "string")) {
      throw new ValidationError("taskIds must be an array of strings");
    }
    collected.push(...(body.taskIds as string[]));
  }

  const trimmed = collected.map((id) => id.trim()).filter(Boolean);
  if (trimmed.length > MAX_OBSERVED_AI_TASKS || trimmed.some((id) => id.length > 128)) {
    throw new ValidationError("最多恢复 50 个 AI 任务");
  }

  return [...new Set(trimmed)];
}

export async function handleAdminAiTasksResume(request: Request) {
  try {
    await requireAdminSession();
    const body = await parseResumeBody(request);
    const taskIds = normalizeResumeTaskIds(request, body);
    const includeSummaryJobs = body.includeSummaryJobs === true;

    let resumedBatchTasks = 0;
    if (taskIds.length > 0) {
      for (const id of taskIds) {
        resumedBatchTasks += await resumeAiBatchTasks(id);
      }
      if (includeSummaryJobs) {
        resumedBatchTasks += await resumeAiBatchTasks();
      }
    } else {
      resumedBatchTasks = await resumeAiBatchTasks();
    }

    const resumedSummaryJobs = includeSummaryJobs ? await resumePostSummaryJobs() : 0;

    return NextResponse.json(
      {
        success: true,
        data: {
          resumedBatchTasks,
          resumedSummaryJobs,
        },
      },
      { status: 202 },
    );
  } catch (error) {
    return toErrorResponse(error, "AI task resume failed");
  }
}

export const POST = withApiOperationLogging(handleAdminAiTasksResume, {
  scope: "admin",
  operation: "admin.ai.tasks.resume",
  route: "/api/admin/ai/tasks/resume",
});
