import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { createAiBatchTask, resumeAiBatchTasks } from "@/lib/ai-batch-jobs";
import { toErrorResponse } from "@/lib/api-errors";

type Body = {
  postIds?: string[];
  actions?: string[];
  mode?: string;
  apply?: boolean;
  modelId?: string;
};

/**
 * 创建文章 AI 批量补全任务。
 *
 * 返回 202 表示已经创建并调度了异步任务；返回 200 表示没有可执行任务项。
 */
export async function POST(request: Request) {
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

/**
 * 恢复仍处于活动态的批量补全任务。
 *
 * 前端轮询同步器使用 resume=1 触发，避免进程中断后任务长时间停在 queued/running。
 */
export async function GET(request: Request) {
  try {
    await requireAdminSession();
    const { searchParams } = new URL(request.url);

    if (searchParams.get("resume") === "1") {
      await resumeAiBatchTasks(searchParams.get("taskId"));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, "AI batch resume failed");
  }
}
