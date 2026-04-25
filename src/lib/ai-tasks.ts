import { NotFoundError, ValidationError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const AI_TASK_STATUSES = {
  queued: "QUEUED",
  running: "RUNNING",
  succeeded: "SUCCEEDED",
  partialFailed: "PARTIAL_FAILED",
  failed: "FAILED",
} as const;

export const AI_TASK_ITEM_STATUSES = {
  queued: "QUEUED",
  running: "RUNNING",
  succeeded: "SUCCEEDED",
  failed: "FAILED",
  skipped: "SKIPPED",
} as const;

export type AiTaskStatus = (typeof AI_TASK_STATUSES)[keyof typeof AI_TASK_STATUSES];
export type AiTaskItemStatus = (typeof AI_TASK_ITEM_STATUSES)[keyof typeof AI_TASK_ITEM_STATUSES];

export type AiTaskType =
  | "post-summary"
  | "post-seo-description"
  | "post-title-suggestion"
  | "post-slug-suggestion"
  | "post-tag-suggestion"
  | "post-category-suggestion"
  | "post-bulk-completion";

export type AiTaskSource = "single-post" | "bulk-posts" | "retry";

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type AiTaskItemInput = {
  postId?: string | null;
  action: string;
  inputSnapshot?: JsonValue;
  status?: AiTaskItemStatus;
};

export type CreateAiTaskInput = {
  type: AiTaskType;
  source: AiTaskSource;
  modelId?: string | null;
  createdById?: string | null;
  metadata?: JsonValue;
  items?: AiTaskItemInput[];
};

export const AI_TASK_PAGE_SIZE = 20;

export type CreatedAiTaskItem = {
  id: string;
  taskId: string;
  postId: string | null;
  status: string;
  action: string;
  inputSnapshot: JsonValue | null;
  output: JsonValue | null;
  applied: boolean;
  error: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreatedAiTask = {
  id: string;
  type: string;
  status: string;
  source: string;
  modelId: string | null;
  createdById: string | null;
  requestedCount: number;
  succeededCount: number;
  failedCount: number;
  startedAt: Date | null;
  finishedAt: Date | null;
  lastError: string | null;
  metadata: JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  items: CreatedAiTaskItem[];
};

function normalizePage(value: unknown) {
  const page = Number(value);

  return Number.isInteger(page) && page > 0 ? page : 1;
}

function normalizeLimit(value: unknown) {
  const limit = Number(value);

  if (!Number.isInteger(limit) || limit <= 0) {
    return AI_TASK_PAGE_SIZE;
  }

  return Math.min(limit, 50);
}

function resolveTaskStatus({ succeeded, failed, skipped, total }: { succeeded: number; failed: number; skipped: number; total: number }) {
  if (total === 0) {
    return AI_TASK_STATUSES.succeeded;
  }

  const completed = succeeded + failed + skipped;
  if (completed < total) {
    return AI_TASK_STATUSES.running;
  }

  if (failed === 0) {
    return AI_TASK_STATUSES.succeeded;
  }

  if (succeeded > 0 || skipped > 0) {
    return AI_TASK_STATUSES.partialFailed;
  }

  return AI_TASK_STATUSES.failed;
}

function toJson(value: JsonValue | undefined) {
  return value === undefined ? undefined : (value as unknown as Prisma.InputJsonValue);
}

export async function createAiTask(input: CreateAiTaskInput): Promise<CreatedAiTask> {
  const items = input.items ?? [];

  return prisma.aiTask.create({
    data: {
      type: input.type,
      status: items.length > 0 ? AI_TASK_STATUSES.queued : AI_TASK_STATUSES.succeeded,
      source: input.source,
      modelId: input.modelId ?? null,
      createdById: input.createdById ?? null,
      requestedCount: items.length,
      metadata: toJson(input.metadata),
      ...(items.length > 0
        ? {
            items: {
              create: items.map((item) => ({
                postId: item.postId ?? null,
                action: item.action,
                status: item.status ?? AI_TASK_ITEM_STATUSES.queued,
                inputSnapshot: toJson(item.inputSnapshot),
              })),
            },
          }
        : {}),
    },
    include: { items: true },
  }) as unknown as Promise<CreatedAiTask>;
}

export async function markAiTaskRunning(taskId: string) {
  return prisma.aiTask.update({
    where: { id: taskId },
    data: {
      status: AI_TASK_STATUSES.running,
      startedAt: new Date(),
      finishedAt: null,
      lastError: null,
    },
  });
}

export async function markAiTaskItemRunning(itemId: string) {
  return prisma.aiTaskItem.update({
    where: { id: itemId },
    data: {
      status: AI_TASK_ITEM_STATUSES.running,
      startedAt: new Date(),
      finishedAt: null,
      error: null,
    },
  });
}

export async function markAiTaskItemSucceeded(itemId: string, output?: JsonValue, applied = false) {
  const item = await prisma.aiTaskItem.update({
    where: { id: itemId },
    data: {
      status: AI_TASK_ITEM_STATUSES.succeeded,
      output: toJson(output),
      applied,
      error: null,
      finishedAt: new Date(),
    },
    select: { taskId: true },
  });

  await refreshAiTaskCounts(item.taskId);
}

export async function markAiTaskItemFailed(itemId: string, error: string) {
  const item = await prisma.aiTaskItem.update({
    where: { id: itemId },
    data: {
      status: AI_TASK_ITEM_STATUSES.failed,
      error,
      finishedAt: new Date(),
    },
    select: { taskId: true },
  });

  await refreshAiTaskCounts(item.taskId);
}

export async function markAiTaskItemSkipped(itemId: string, error?: string) {
  const item = await prisma.aiTaskItem.update({
    where: { id: itemId },
    data: {
      status: AI_TASK_ITEM_STATUSES.skipped,
      error: error ?? null,
      finishedAt: new Date(),
    },
    select: { taskId: true },
  });

  await refreshAiTaskCounts(item.taskId);
}

export async function refreshAiTaskCounts(taskId: string) {
  const items = await prisma.aiTaskItem.findMany({
    where: { taskId },
    select: { status: true, error: true },
  });
  const succeeded = items.filter((item) => item.status === AI_TASK_ITEM_STATUSES.succeeded).length;
  const failedItems = items.filter((item) => item.status === AI_TASK_ITEM_STATUSES.failed);
  const skipped = items.filter((item) => item.status === AI_TASK_ITEM_STATUSES.skipped).length;
  const failed = failedItems.length;
  const status = resolveTaskStatus({ succeeded, failed, skipped, total: items.length });
  const finished = status !== AI_TASK_STATUSES.running;

  return prisma.aiTask.update({
    where: { id: taskId },
    data: {
      status,
      requestedCount: items.length,
      succeededCount: succeeded,
      failedCount: failed,
      finishedAt: finished ? new Date() : null,
      lastError: failedItems.at(-1)?.error ?? null,
    },
  });
}

export async function listAiTasks({
  page,
  limit,
  status,
  type,
}: {
  page?: unknown;
  limit?: unknown;
  status?: string | null;
  type?: string | null;
}) {
  const currentPage = normalizePage(page);
  const pageSize = normalizeLimit(limit);
  const where = {
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
  };
  const [total, tasks] = await Promise.all([
    prisma.aiTask.count({ where }),
    prisma.aiTask.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        items: {
          take: 3,
          orderBy: { createdAt: "asc" },
          include: { post: { select: { id: true, title: true, slug: true } } },
        },
      },
    }),
  ]);

  return {
    tasks,
    pagination: {
      page: currentPage,
      limit: pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export async function getAiTaskDetail(taskId: string) {
  const task = await prisma.aiTask.findUnique({
    where: { id: taskId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          post: {
            select: {
              id: true,
              title: true,
              slug: true,
              excerpt: true,
              seoDescription: true,
            },
          },
        },
      },
    },
  });

  if (!task) {
    throw new NotFoundError("AI task not found");
  }

  return task;
}

export async function getAiTaskItem(itemId: string) {
  const item = await prisma.aiTaskItem.findUnique({
    where: { id: itemId },
    include: {
      task: true,
      post: {
        include: {
          category: { select: { id: true, name: true, slug: true } },
          tags: { where: { deletedAt: null }, select: { id: true, name: true, slug: true } },
        },
      },
    },
  });

  if (!item) {
    throw new NotFoundError("AI task item not found");
  }

  return item;
}

export async function retryAiTaskFailedItems(taskId: string, createdById?: string | null) {
  const task = await getAiTaskDetail(taskId);
  const failedItems = task.items.filter((item) => item.status === AI_TASK_ITEM_STATUSES.failed);
  const metadata = task.metadata && typeof task.metadata === "object" && !Array.isArray(task.metadata) ? (task.metadata as Record<string, unknown>) : {};

  if (failedItems.length === 0) {
    throw new ValidationError("No failed AI task items to retry");
  }

  return createAiTask({
    type: task.type as AiTaskType,
    source: "retry",
    modelId: task.modelId,
    createdById,
    metadata: {
      retryOfTaskId: task.id,
      apply: metadata.apply === true,
      originalTaskType: task.type,
    },
    items: failedItems.map((item) => ({
      postId: item.postId,
      action: item.action,
      inputSnapshot: (item.inputSnapshot ?? null) as JsonValue,
    })),
  });
}

export function isAiTaskActive(status: string | null | undefined) {
  return status === AI_TASK_STATUSES.queued || status === AI_TASK_STATUSES.running;
}
