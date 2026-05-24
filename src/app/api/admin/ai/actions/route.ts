import { withApiOperationLogging } from "@/lib/api-operation-log-route";
/**
 * 后台单篇文章 AI 动作执行入口。
 *
 * 职责：
 * - 校验管理员身份
 * - 接收“已保存文章”或“未保存草稿”的 AI 动作请求
 * - 创建 AI 任务与任务项，驱动执行并记录结果
 * - 返回前端可直接预览或后续 apply 的结构化输出
 */
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

const POST_AI_ACTION_PROMPT_VERSION = "post-ai-action-v1";

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

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readOutputObject(output: unknown) {
  return output && typeof output === "object" && !Array.isArray(output) ? (output as Record<string, unknown>) : {};
}

function withOutputMeta(output: unknown, meta: Record<string, JsonValue>) {
  return {
    ...readOutputObject(output),
    _meta: meta,
  };
}

async function resolvePostInput(body: Body, action: string) {
  const postId = readString(body.postId);
  const hasDraft = Boolean(body.draft && typeof body.draft === "object");

  if (!postId && !hasDraft) {
    throw new ValidationError("Post id or draft content is required");
  }

  if (hasDraft) {
    const draftInput = {
      ...body.draft,
      content: action === "slug" && !readString(body.draft?.content) ? readString(body.draft?.title) : body.draft?.content,
    };
    const draftPost = await buildDraftPostForAiAction(draftInput);
    return {
      post: postId ? { ...draftPost, id: postId } : draftPost,
      postId: postId || null,
      source: postId ? "single-post" : "draft-post",
      draft: true,
    } as const;
  }

  return {
    post: await getPostForAiAction(postId),
    postId,
    source: "single-post",
    draft: false,
  } as const;
}

async function getSlugQuality(output: Record<string, unknown>, postId: string | null) {
  const slug = readString(output.slug);
  if (!slug) return null;

  const conflict = await prisma.post.findFirst({
    where: {
      slug,
      deletedAt: null,
      ...(postId ? { NOT: { id: postId } } : {}),
    },
    select: { id: true, title: true },
  });

  return {
    score: conflict ? 70 : 100,
    blockedFields: conflict ? ["slug"] : [],
    checks: [
      conflict
        ? { key: "slug-unique", label: "Slug 唯一性", status: "danger", message: `已被《${conflict.title}》使用，应用时会保留原 Slug。` }
        : { key: "slug-unique", label: "Slug 唯一性", status: "ok", message: "未发现重复 Slug。" },
    ],
  };
}

/**
 * 执行一次文章 AI 动作。
 *
 * 副作用：
 * - 创建任务记录
 * - 更新任务状态
 * - 在失败时写入任务错误信息
 */
async function POSTHandler(request: Request) {
  try {
    const session = await requireAdminSession();
    const body = (await request.json()) as Body;

    if (!body.action) {
      throw new ValidationError("AI action is required");
    }

    const action = normalizePostAiAction(body.action);
    const { draft, post, postId, source } = await resolvePostInput(body, action);
    const metadata = {
      draft,
      promptVersion: POST_AI_ACTION_PROMPT_VERSION,
    };
    const task = await createAiTask({
      type: getAiTaskTypeForAction(action),
      source,
      modelId: body.modelId ?? null,
      createdById: session.user.id,
      metadata,
      items: [
        {
          postId,
          action,
          status: AI_TASK_ITEM_STATUSES.queued,
          inputSnapshot: {
            ...(buildPostAiInputSnapshot(post, action) as Record<string, JsonValue>),
            draft,
            promptVersion: POST_AI_ACTION_PROMPT_VERSION,
          },
        },
      ],
    });
    const item = task.items[0];

    await markAiTaskRunning(task.id);
    await markAiTaskItemRunning(item.id);

    const startedAt = Date.now();
    try {
      const result = await runPostAiAction({ post, action, modelId: body.modelId });
      const durationMs = Date.now() - startedAt;
      if (result.modelId !== task.modelId) {
        await prisma.aiTask.update({ where: { id: task.id }, data: { modelId: result.modelId } });
      }
      const quality = action === "slug" ? await getSlugQuality(readOutputObject(result.output), postId) : null;
      const output = withOutputMeta(result.output, {
        modelId: result.modelId ?? null,
        durationMs,
        promptVersion: POST_AI_ACTION_PROMPT_VERSION,
        ...(quality ? { quality } : {}),
      });
      await markAiTaskItemSucceeded(item.id, output as JsonValue);

      return NextResponse.json({
        success: true,
        data: {
          taskId: task.id,
          itemId: item.id,
          action,
          modelId: result.modelId,
          durationMs,
          output,
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

export const POST = withApiOperationLogging(POSTHandler, { scope: 'admin', operation: 'admin.ai.actions.create', route: '/api/admin/ai/actions' });
