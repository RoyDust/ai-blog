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
  buildDraftPostForAiAction,
  buildPostAiInputSnapshot,
  getAiTaskTypeForAction,
  getPostForAiAction,
  normalizePostAiAction,
  runPostAiAction,
} from "@/lib/ai-post-actions";
import { toErrorResponse, ValidationError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";

type Body = {
  postId?: string;
  draft?: {
    title?: unknown;
    slug?: unknown;
    content?: unknown;
    excerpt?: unknown;
    seoDescription?: unknown;
    categoryId?: unknown;
    tagIds?: unknown;
  };
  action?: string;
  modelId?: string;
};

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession();
    const body = (await request.json()) as Body;

    if (!body.action) {
      throw new ValidationError("AI action is required");
    }

    if (!body.postId && !body.draft) {
      throw new ValidationError("Post id or draft content is required");
    }

    const action = normalizePostAiAction(body.action);
    const isDraft = !body.postId;
    const post = body.postId ? await getPostForAiAction(body.postId) : await buildDraftPostForAiAction(body.draft ?? {});
    const task = await createAiTask({
      type: getAiTaskTypeForAction(action),
      source: isDraft ? "draft-post" : "single-post",
      modelId: body.modelId ?? null,
      createdById: session.user.id,
      metadata: isDraft ? { draft: true } : undefined,
      items: [
        {
          postId: isDraft ? null : post.id,
          action,
          status: AI_TASK_ITEM_STATUSES.queued,
          inputSnapshot: {
            ...(buildPostAiInputSnapshot(post, action) as Record<string, JsonValue>),
            draft: isDraft,
          },
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
