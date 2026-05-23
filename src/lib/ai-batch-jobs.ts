import {
  AI_TASK_ITEM_STATUSES,
  createAiTask,
  isAiTaskActive,
  markAiTaskItemFailed,
  markAiTaskItemRunning,
  markAiTaskItemSkipped,
  markAiTaskItemSucceeded,
  markAiTaskRunning,
  refreshAiTaskCounts,
  type AiTaskType,
  type JsonValue,
} from "@/lib/ai-tasks";
import {
  POST_AI_ACTIONS,
  applyPostAiTaskItem,
  buildPostAiInputSnapshot,
  getPostForAiAction,
  normalizePostAiAction,
  runPostAiAction,
  type PostAiAction,
} from "@/lib/ai-post-actions";
import { ValidationError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";

const MAX_AI_BATCH_POSTS = 20;
const runningBatchTasks = new Set<string>();
const targetedResumeTaskTypes = [
  "post-bulk-completion",
  "post-article-info",
  "post-seo-description",
  "post-title-suggestion",
  "post-slug-suggestion",
  "post-tag-suggestion",
  "post-category-suggestion",
  "post-cover-image",
] satisfies AiTaskType[];

export type AiBatchMode = "missing-only" | "overwrite" | "suggest-only";

/**
 * 规范化批量任务的文章 id，并去重空值。
 */
function normalizePostIds(ids: unknown) {
  if (!Array.isArray(ids)) {
    return [];
  }

  return Array.from(new Set(ids.map((id) => (typeof id === "string" ? id.trim() : "")).filter(Boolean)));
}

/**
 * 规范化批量任务动作，只保留系统支持的文章 AI 动作。
 */
function normalizeActions(actions: unknown): PostAiAction[] {
  if (!Array.isArray(actions)) {
    return [];
  }

  return Array.from(new Set(actions.map((action) => (typeof action === "string" ? normalizePostAiAction(action) : null)).filter(Boolean))) as PostAiAction[];
}

/**
 * 解析批量任务模式，非法输入回退到“只补缺失”。
 */
function normalizeMode(mode: unknown): AiBatchMode {
  return mode === "overwrite" || mode === "suggest-only" || mode === "missing-only" ? mode : "missing-only";
}

/**
 * 判断某篇文章是否需要为指定动作创建任务项。
 *
 * missing-only 模式会跳过已经有对应字段的文章，避免重复消耗模型额度。
 */
function shouldCreateItemForAction({
  action,
  mode,
  post,
}: {
  action: PostAiAction;
  mode: AiBatchMode;
  post: Awaited<ReturnType<typeof getPostForAiAction>>;
}) {
  if (mode !== "missing-only") {
    return true;
  }

  if (action === POST_AI_ACTIONS.summary) return !post.excerpt?.trim();
  if (action === POST_AI_ACTIONS.seoDescription) return !post.seoDescription?.trim();
  if (action === POST_AI_ACTIONS.tags) return post.tags.length === 0;
  if (action === POST_AI_ACTIONS.category) return !post.category;
  if (action === POST_AI_ACTIONS.coverImage) return !post.coverImage?.trim();
  return false;
}

/**
 * 只有低风险字段允许批量自动应用。
 */
function canAutoApply(action: PostAiAction, apply: boolean) {
  return apply && (action === POST_AI_ACTIONS.summary || action === POST_AI_ACTIONS.seoDescription || action === POST_AI_ACTIONS.coverImage);
}

/**
 * 把批量任务放到当前 Node 进程的异步执行队列。
 */
function scheduleBatchTask(taskId: string, modelId?: string | null, apply = false) {
  setTimeout(() => {
    void runAiBatchTask({ taskId, modelId, apply }).catch((error) => {
      console.error("Run AI batch task error:", error);
    });
  }, 0);
}

/**
 * 创建 AI 批量补全任务。
 *
 * 这里只生成任务和任务项；如果有可执行项，再异步调度 runAiBatchTask。
 */
export async function createAiBatchTask({
  postIds,
  actions,
  mode,
  apply,
  modelId,
  createdById,
}: {
  postIds: unknown;
  actions: unknown;
  mode?: unknown;
  apply?: boolean;
  modelId?: string | null;
  createdById?: string | null;
}) {
  const ids = normalizePostIds(postIds);
  const normalizedActions = normalizeActions(actions);
  const normalizedMode = normalizeMode(mode);
  const shouldApplySafeFields = Boolean(apply) && normalizedMode !== "suggest-only";

  if (ids.length === 0) {
    throw new ValidationError("Post IDs are required");
  }

  if (ids.length > MAX_AI_BATCH_POSTS) {
    throw new ValidationError(`最多一次处理 ${MAX_AI_BATCH_POSTS} 篇文章`);
  }

  if (normalizedActions.length === 0) {
    throw new ValidationError("AI actions are required");
  }

  const posts = await Promise.all(ids.map((id) => getPostForAiAction(id).catch(() => null)));
  const items = posts.flatMap((post) => {
    if (!post) return [];

    return normalizedActions
      .filter((action) => shouldCreateItemForAction({ action, mode: normalizedMode, post }))
      .map((action) => ({
        postId: post.id,
        action,
        inputSnapshot: buildPostAiInputSnapshot(post, action),
      }));
  });

  const task = await createAiTask({
    type: "post-bulk-completion",
    source: "bulk-posts",
    modelId: modelId ?? null,
    createdById,
    metadata: {
      mode: normalizedMode,
      apply: shouldApplySafeFields,
      requestedPostIds: ids,
      actions: normalizedActions,
    },
    items,
  });

  if (items.length > 0) {
    scheduleBatchTask(task.id, modelId, shouldApplySafeFields);
  }

  return task;
}

/**
 * 执行一个 AI 批量任务。
 *
 * runningBatchTasks 防止同一进程内重复恢复同一个任务；逐项失败会记录到任务项，不中断后续项。
 */
export async function runAiBatchTask({
  taskId,
  modelId,
  apply = false,
}: {
  taskId: string;
  modelId?: string | null;
  apply?: boolean;
}) {
  if (runningBatchTasks.has(taskId)) {
    return;
  }

  runningBatchTasks.add(taskId);

  try {
    await markAiTaskRunning(taskId);
    let resolvedModelId = modelId ?? null;

    const items = await prisma.aiTaskItem.findMany({
      where: {
        taskId,
        status: { in: [AI_TASK_ITEM_STATUSES.queued, AI_TASK_ITEM_STATUSES.running] },
      },
      orderBy: { createdAt: "asc" },
    });

    for (const item of items) {
      const action = normalizePostAiAction(item.action);

      if (!item.postId) {
        await markAiTaskItemSkipped(item.id, "Post not found");
        continue;
      }

      await markAiTaskItemRunning(item.id);

      try {
        const post = await getPostForAiAction(item.postId);
        const result = await runPostAiAction({ post, action, modelId });
        if (!resolvedModelId && result.modelId) {
          resolvedModelId = result.modelId;
          await prisma.aiTask.update({ where: { id: taskId }, data: { modelId: result.modelId } });
        }
        await markAiTaskItemSucceeded(item.id, result.output as unknown as JsonValue, false);

        if (canAutoApply(action, apply)) {
          await applyPostAiTaskItem(item.id);
        }
      } catch (error) {
        await markAiTaskItemFailed(item.id, error instanceof Error ? error.message : "AI batch item failed");
      }
    }

    await refreshAiTaskCounts(taskId);
  } finally {
    runningBatchTasks.delete(taskId);
  }
}

/**
 * 恢复仍处于活跃状态的批量任务。
 *
 * 页面轮询和 API resume 参数都会走这里，用于补偿进程重启或请求中断后的任务。
 */
export async function resumeAiBatchTasks(taskId?: string | null) {
  const tasks = await prisma.aiTask.findMany({
    where: {
      ...(taskId ? { id: taskId } : {}),
      type: taskId ? { in: targetedResumeTaskTypes } : "post-bulk-completion",
    },
    select: { id: true, modelId: true, metadata: true, status: true },
    orderBy: { createdAt: "desc" },
    take: taskId ? 1 : 10,
  });

  for (const task of tasks) {
    if (!isAiTaskActive(task.status) || runningBatchTasks.has(task.id)) {
      continue;
    }

    const metadata = task.metadata && typeof task.metadata === "object" ? (task.metadata as { apply?: unknown }) : {};
    scheduleBatchTask(task.id, task.modelId, metadata.apply === true);
  }

  return tasks.length;
}
