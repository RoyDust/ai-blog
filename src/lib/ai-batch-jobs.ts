import {
  AI_TASK_ITEM_STATUSES,
  createAiTask,
  isAiTaskActive,
  markAiTaskItemFailed,
  markAiTaskItemRunning,
  markAiTaskItemSkipped,
  markAiTaskRunning,
  refreshAiTaskCounts,
  type AiTaskType,
  type JsonValue,
} from "@/lib/ai-tasks";
import {
  POST_AI_ACTIONS,
  completePostAiTaskItem,
  buildPostAiInputSnapshot,
  getPostForAiAction,
  normalizePostAiAction,
  runPostAiAction,
  type PostAiAction,
} from "@/lib/ai-post-actions";
import { NotFoundError, ValidationError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
import { AiInfrastructureError } from "@/lib/ai-task-errors";

const MAX_AI_BATCH_POSTS = 20;
export const MAX_OBSERVED_AI_TASKS = 50;
const runningBatchTasks = new Set<string>();
const targetedResumeTaskTypes = [
  "post-bulk-completion",
  "post-seo-description",
  "post-title-suggestion",
  "post-slug-suggestion",
  "post-tag-suggestion",
  "post-category-suggestion",
  "post-cover-image",
] satisfies AiTaskType[];

export type AiBatchMode = "missing-only" | "overwrite" | "suggest-only";

/** A bounded read by the page's observed IDs includes the last terminal transition. */
export async function getAiBatchTaskSnapshot(taskIds: string[]) {
  const ids = [...new Set(taskIds.map((id) => id.trim()).filter(Boolean))].sort();
  if (taskIds.length > MAX_OBSERVED_AI_TASKS || ids.some((id) => id.length > 128)) throw new ValidationError("最多观察 50 个 AI 任务");
  if (ids.length === 0) return { active: false, tasks: [], missingTaskIds: [] };
  const rows = await prisma.aiTask.findMany({
    where: { id: { in: ids } }, take: MAX_OBSERVED_AI_TASKS, orderBy: { id: "asc" },
    select: { id: true, status: true, requestedCount: true, succeededCount: true, failedCount: true, updatedAt: true, items: { select: { id: true, status: true, updatedAt: true }, orderBy: { id: "asc" } } },
  });
  const tasks = rows.map((task) => ({
    id: task.id, status: task.status,
    counts: { requested: task.requestedCount, succeeded: task.succeededCount, failed: task.failedCount,
      queued: task.items.filter((item) => item.status === "QUEUED").length,
      running: task.items.filter((item) => item.status === "RUNNING").length,
      skipped: task.items.filter((item) => item.status === "SKIPPED").length },
    version: [task.updatedAt.toISOString(), ...task.items.map((item) => item.id + ":" + item.updatedAt.toISOString())].join("|"),
  }));
  return { active: tasks.some((task) => isAiTaskActive(task.status)), tasks, missingTaskIds: ids.filter((id) => !tasks.some((task) => task.id === id)) };
}

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

/** 把批量任务放到当前 Node 进程的异步执行队列。 */
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
    if (!await markAiTaskRunning(taskId)) return;

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
        await markAiTaskItemSkipped(item.id, "Post not found", taskId);
        continue;
      }

      if (!await markAiTaskItemRunning(item.id, taskId)) continue;
      let post: Awaited<ReturnType<typeof getPostForAiAction>>;
      try {
        post = await getPostForAiAction(item.postId);
      } catch (error) {
        if (!(error instanceof NotFoundError)) throw error;
        await markAiTaskItemSkipped(item.id, "Post not found", taskId);
        continue;
      }
      let result: Awaited<ReturnType<typeof runPostAiAction>>;
      try {
        result = await runPostAiAction({ post, action, modelId });
      } catch (error) {
        if (error instanceof AiInfrastructureError) throw error;
        await markAiTaskItemFailed(item.id, error instanceof Error ? error.message : "AI batch item failed", taskId);
        continue;
      }
      // Database/notification failures must escape without changing the active item to FAILED.
      try {
        await completePostAiTaskItem({ taskId, itemId: item.id, post, action, expectedInputSnapshot: item.inputSnapshot as JsonValue | null, output: result.output as unknown as JsonValue, modelId: result.modelId, apply });
      } catch (error) {
        if (!(error instanceof ValidationError)) throw error;
        await markAiTaskItemFailed(item.id, error.message, taskId);
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
