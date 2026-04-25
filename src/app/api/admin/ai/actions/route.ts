import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import {
  AI_TASK_ITEM_STATUSES,
  createAiTask,
  markAiTaskItemFailed,
  markAiTaskItemRunning,
  markAiTaskItemSucceeded,
  markAiTaskRunning,
  type JsonValue,
} from "@/lib/ai-tasks";
import {
  buildPostAiInputSnapshot,
  getAiTaskTypeForAction,
  getPostForAiAction,
  normalizePostAiAction,
  runPostAiAction,
} from "@/lib/ai-post-actions";
import { toErrorResponse } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";

type Body = {
  postId?: string;
  action?: string;
  modelId?: string;
};

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    const body = (await request.json()) as Body;

    if (!body.postId || !body.action) {
      return NextResponse.json({ error: "Post id and AI action are required" }, { status: 400 });
    }

    const action = normalizePostAiAction(body.action);
    const post = await getPostForAiAction(body.postId);
    const task = await createAiTask({
      type: getAiTaskTypeForAction(action),
      source: "single-post",
      modelId: body.modelId ?? null,
      createdById: session.user.id,
      items: [
        {
          postId: post.id,
          action,
          status: AI_TASK_ITEM_STATUSES.queued,
          inputSnapshot: buildPostAiInputSnapshot(post, action),
        },
      ],
    });
    const item = task.items[0];

    await markAiTaskRunning(task.id);
    await markAiTaskItemRunning(item.id);

    try {
      const result = await runPostAiAction({ post, action, modelId: body.modelId });
      if (result.modelId !== task.modelId) {
        await prisma.aiTask.update({ where: { id: task.id }, data: { modelId: result.modelId } });
      }
      await markAiTaskItemSucceeded(item.id, result.output as unknown as JsonValue);

      return NextResponse.json({
        success: true,
        data: {
          taskId: task.id,
          itemId: item.id,
          action,
          modelId: result.modelId,
          output: result.output,
        },
      });
    } catch (error) {
      await markAiTaskItemFailed(item.id, error instanceof Error ? error.message : "AI action failed");
      throw error;
    }
  } catch (error) {
    return toErrorResponse(error, "AI action failed");
  }
}
