import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";

import { getAiModelForCapability } from "@/lib/ai-models";
import {
  AI_TASK_ITEM_STATUSES,
  createAiTask,
  isAiTaskActive,
  lockAiTask,
  markAiTaskItemFailed,
  markAiTaskItemRunning,
  markAiTaskItemSkipped,
  markAiTaskItemSucceeded,
  markAiTaskRunning,
  refreshAiTaskCounts,
} from "@/lib/ai-tasks";
import { ApiError, ValidationError } from "@/lib/api-errors";
import { revalidatePublicContentStrict } from "@/lib/cache";
import { generatePostSummary } from "@/lib/post-summary";
import {
  ACTIVE_SUMMARY_STATUSES,
  isActiveSummaryStatus,
  POST_SUMMARY_STATUSES,
  type PostSummaryStatus,
} from "@/lib/post-summary-status";
import { prisma } from "@/lib/prisma";

export const MAX_BULK_SUMMARY_POSTS = 20;

const runningSummaryJobs = new Set<string>();
const SUPERSEDED_SUMMARY_MESSAGE = "文章已修改、删除或已有新摘要任务，本次结果未应用";

type SummaryPost = {
  id: string;
  title: string;
  content: string;
  excerpt: string | null;
  slug: string;
  published: boolean;
  series: { slug: string } | null;
  category: { slug: string } | null;
  tags: Array<{ slug: string }>;
};

export function normalizeSummaryPostIds(ids: unknown) {
  if (!Array.isArray(ids)) {
    return [];
  }

  return Array.from(new Set(ids.map((id) => (typeof id === "string" ? id.trim() : "")).filter(Boolean)));
}

function scheduleSummaryJob(jobId: string, modelId?: string | null) {
  setTimeout(() => {
    void runPostSummaryJob(jobId, modelId).catch((error) => {
      console.error("Run post summary job error:", error);
    });
  }, 0);
}

export async function createPostSummaryJob({ ids, modelId }: { ids: unknown; modelId?: string | null }) {
  const normalizedIds = normalizeSummaryPostIds(ids);

  if (normalizedIds.length === 0) {
    throw new ValidationError("Post IDs are required");
  }

  if (normalizedIds.length > MAX_BULK_SUMMARY_POSTS) {
    throw new ValidationError(`最多一次生成 ${MAX_BULK_SUMMARY_POSTS} 篇文章摘要`);
  }

  const aiModel = await getAiModelForCapability("post-summary", modelId);
  if (!aiModel) {
    throw new ValidationError("AI model is not available for post summaries");
  }

  if (!aiModel.apiKey) {
    throw new ApiError(500, `${aiModel.apiKeyEnv} is not configured`);
  }

  const posts = await prisma.post.findMany({
    where: { id: { in: normalizedIds }, deletedAt: null },
    select: { id: true, title: true, content: true, published: true, slug: true,
      category: { select: { slug: true } }, tags: { where: { deletedAt: null }, select: { slug: true } }, series: { select: { slug: true } } },
  });
  const postsById = new Map(posts.map((post) => [post.id, post]));
  const queuedIds: string[] = [];
  const results: Array<{
    id: string;
    title?: string;
    status: "queued" | "failed";
    error?: string;
  }> = [];

  for (const id of normalizedIds) {
    const post = postsById.get(id);

    if (!post) {
      results.push({ id, status: "failed", error: "Post not found" });
      continue;
    }

    if (!post.content.trim()) {
      results.push({ id, title: post.title, status: "failed", error: "Article content is required" });
      continue;
    }

    queuedIds.push(id);
    results.push({ id, title: post.title, status: "queued" });
  }

  const task =
    queuedIds.length > 0
      ? await createAiTask({
          type: "post-summary",
          source: "bulk-posts",
          modelId: aiModel.id,
          metadata: { requestedIds: normalizedIds },
          items: queuedIds.map((id) => {
            const post = postsById.get(id);

            return {
              postId: id,
              action: "summary",
              inputSnapshot: {
                title: post?.title ?? "",
                contentLength: post?.content.length ?? 0,
                published: post?.published ?? false,
                slug: post?.slug ?? '',
                categorySlug: post?.category?.slug ?? null,
                tagSlugs: post?.tags?.map((tag) => tag.slug) ?? [],
                seriesSlug: post?.series?.slug ?? null,
              },
            };
          }),
        })
      : null;
  const jobId = task?.id ?? randomUUID();

  if (queuedIds.length > 0) {
    await prisma.post.updateMany({
      where: { id: { in: queuedIds }, deletedAt: null },
      data: {
        summaryStatus: POST_SUMMARY_STATUSES.queued,
        summaryError: null,
        summaryJobId: jobId,
        summaryModelId: aiModel.id,
      },
    });

    scheduleSummaryJob(jobId, aiModel.id);
  }

  const failed = results.filter((result) => result.status === "failed").length;

  return {
    jobId,
    taskId: task?.id ?? null,
    modelId: aiModel.id,
    requested: normalizedIds.length,
    queued: queuedIds.length,
    failed,
    results,
  };
}

export async function runPostSummaryJob(jobId: string, modelId?: string | null) {
  if (runningSummaryJobs.has(jobId)) {
    return;
  }

  runningSummaryJobs.add(jobId);

  try {
    const task = await prisma.aiTask.findUnique({
      where: { id: jobId },
      include: {
        items: {
          where: { status: { in: [AI_TASK_ITEM_STATUSES.queued, AI_TASK_ITEM_STATUSES.running] } },
          select: { id: true, postId: true },
        },
      },
    });
    const taskItemsByPostId = new Map((task?.items ?? []).map((item) => [item.postId, item.id]));

    if (task) {
      if (!await markAiTaskRunning(task.id)) return;
    }

    const posts = (await prisma.post.findMany({
      where: {
        deletedAt: null,
        summaryJobId: jobId,
        summaryStatus: { in: ACTIVE_SUMMARY_STATUSES },
      },
      select: {
        id: true,
        title: true,
        content: true,
        excerpt: true,
        slug: true,
        published: true,
        series: { select: { slug: true } },
        category: { select: { slug: true } },
        tags: { where: { deletedAt: null }, select: { slug: true } },
      },
      orderBy: { createdAt: "asc" },
    })) as SummaryPost[];

    const activePostIds = new Set(posts.map((post) => post.id));
    for (const item of task?.items ?? []) {
      if (!item.postId || !activePostIds.has(item.postId)) {
        await markAiTaskItemSkipped(item.id, SUPERSEDED_SUMMARY_MESSAGE);
      }
    }
    if (posts.length === 0) {
      if (task) await refreshAiTaskCounts(task.id);
      return;
    }

    const aiModel = await getAiModelForCapability("post-summary", modelId);

    for (const post of posts) {
      const taskItemId = taskItemsByPostId.get(post.id);
      const ownedPost = { id: post.id, deletedAt: null, summaryJobId: jobId };
      // 把所有影响摘要的输入放进同一条条件更新，避免检查后再写入的竞态。
      const unchangedPost = { ...ownedPost, title: post.title, content: post.content, excerpt: post.excerpt };
      const withCompletionTransaction = async <T>(write: (client: Prisma.TransactionClient) => Promise<T>) => {
        if (!taskItemId || !task) return write(prisma);
        return prisma.$transaction(async (client) => {
          const currentTask = await lockAiTask(client, task.id);
          if (!isAiTaskActive(currentTask.status)) return null;
          await client.$queryRawUnsafe('SELECT id FROM ai_task_items WHERE id = $1 FOR UPDATE', taskItemId);
          const currentItem = await client.aiTaskItem.findUnique({ where: { id: taskItemId } });
          if (!currentItem || currentItem.taskId !== task.id || currentItem.postId !== post.id || !isAiTaskActive(currentItem.status)) return null;
          return write(client);
        });
      };
      const skipSupersededPost = async (transaction?: Prisma.TransactionClient) => {
        const skip = async (client: Prisma.TransactionClient) => {
          // 正文变化但任务号未变时结束旧状态；新任务和已手工保存的摘要不受影响。
          await client.post.updateMany({
            where: { ...ownedPost, summaryStatus: { in: ACTIVE_SUMMARY_STATUSES } },
            data: { summaryStatus: POST_SUMMARY_STATUSES.failed, summaryError: SUPERSEDED_SUMMARY_MESSAGE },
          });
          if (taskItemId) await markAiTaskItemSkipped(taskItemId, SUPERSEDED_SUMMARY_MESSAGE, jobId, client);
        };
        return transaction ? skip(transaction) : withCompletionTransaction(skip);
      };

      if (!aiModel?.apiKey) {
        const message = aiModel ? `${aiModel.apiKeyEnv} is not configured` : "AI model is not available for post summaries";
        await withCompletionTransaction(async (client) => {
          const failed = await client.post.updateMany({
            where: { ...unchangedPost, summaryStatus: { in: ACTIVE_SUMMARY_STATUSES } },
            data: { summaryStatus: POST_SUMMARY_STATUSES.failed, summaryError: message, summaryModelId: modelId ?? null },
          });
          if (failed.count === 0) await skipSupersededPost(client);
          else if (taskItemId) await markAiTaskItemFailed(taskItemId, message, jobId, client);
        });
        continue;
      }

      const claimed = await prisma.post.updateMany({
        where: {
          ...unchangedPost,
          summaryStatus: { in: ACTIVE_SUMMARY_STATUSES },
        },
        data: {
          summaryStatus: POST_SUMMARY_STATUSES.generating,
          summaryError: null,
          summaryModelId: aiModel.id,
        },
      });

      if (claimed.count === 0) {
        await skipSupersededPost();
        continue;
      }

      if (taskItemId) await markAiTaskItemRunning(taskItemId);

      const pendingPost = { ...unchangedPost, summaryStatus: POST_SUMMARY_STATUSES.generating };
      let excerpt: string;
      try {
        const content = post.content.trim();
        if (!content) throw new Error("Article content is required");
        excerpt = await generatePostSummary({ aiModel, title: post.title, content });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Summary generation failed";
        await withCompletionTransaction(async (client) => {
          const failed = await client.post.updateMany({
            where: pendingPost,
            data: {
              summaryStatus: POST_SUMMARY_STATUSES.failed,
              summaryError: message,
              summaryModelId: aiModel.id,
            },
          });
          if (failed.count === 0) await skipSupersededPost(client);
          else if (taskItemId) await markAiTaskItemFailed(taskItemId, message, jobId, client);
        });
        continue;
      }

      const committed = await withCompletionTransaction(async (client) => {
        const applied = await client.post.updateMany({
          where: pendingPost,
          data: {
            excerpt,
            summaryStatus: POST_SUMMARY_STATUSES.generated,
            summaryError: null,
            summaryGeneratedAt: new Date(),
            summaryModelId: aiModel.id,
          },
        });
        if (applied.count === 0) {
          await skipSupersededPost(client);
          return false;
        }

        if (taskItemId) await markAiTaskItemSucceeded(taskItemId, { summary: excerpt }, true, client);
        return true;
      });
      if (!committed) continue;
      try {
        const report = revalidatePublicContentStrict({
          slug: post.slug,
          categorySlug: post.category?.slug,
          tagSlugs: post.tags.map((tag) => tag.slug),
          seriesSlug: post.series?.slug,
        });
        if (report.errors.length) console.error('Summary cache refresh incomplete', { taskId: jobId, postId: post.id, errors: report.errors });
      } catch (error) {
        console.error('Summary cache refresh failed', { taskId: jobId, postId: post.id, path: '/posts/' + post.slug, error });
      }
    }

    if (task) {
      await refreshAiTaskCounts(task.id);
    }
  } finally {
    runningSummaryJobs.delete(jobId);
  }
}

export async function resumePostSummaryJobs(jobId?: string | null) {
  const activePosts = await prisma.post.findMany({
    where: {
      deletedAt: null,
      summaryStatus: { in: ACTIVE_SUMMARY_STATUSES },
      ...(jobId ? { summaryJobId: jobId } : {}),
    },
    select: {
      summaryJobId: true,
      summaryModelId: true,
    },
  });
  const jobs = new Map<string, string | null>();

  for (const post of activePosts) {
    if (post.summaryJobId) {
      jobs.set(post.summaryJobId, post.summaryModelId ?? null);
    }
  }

  for (const [activeJobId, activeModelId] of jobs) {
    if (!runningSummaryJobs.has(activeJobId)) {
      scheduleSummaryJob(activeJobId, activeModelId);
    }
  }

  return jobs.size;
}

export async function getPostSummaryJobSnapshot(jobId?: string | null) {
  const posts = await prisma.post.findMany({
    where: jobId
      ? { summaryJobId: jobId, deletedAt: null }
      : { summaryStatus: { in: ACTIVE_SUMMARY_STATUSES }, deletedAt: null },
    select: {
      id: true,
      title: true,
      excerpt: true,
      summaryStatus: true,
      summaryError: true,
      summaryGeneratedAt: true,
      summaryJobId: true,
    },
    orderBy: { updatedAt: "desc" },
  });
  const counts = posts.reduce(
    (acc, post) => {
      const status = String(post.summaryStatus ?? POST_SUMMARY_STATUSES.empty) as PostSummaryStatus;
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    },
    {} as Partial<Record<PostSummaryStatus, number>>,
  );

  return {
    active: posts.some((post) => isActiveSummaryStatus(String(post.summaryStatus))),
    counts,
    posts,
  };
}
