import { randomUUID } from "node:crypto";

import { getAiModelForCapability } from "@/lib/ai-models";
import {
  AI_TASK_ITEM_STATUSES,
  createAiTask,
  markAiTaskItemFailed,
  markAiTaskItemRunning,
  markAiTaskItemSucceeded,
  markAiTaskRunning,
  refreshAiTaskCounts,
} from "@/lib/ai-tasks";
import { ApiError, ValidationError } from "@/lib/api-errors";
import { revalidatePublicContent } from "@/lib/cache";
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

type SummaryPost = {
  id: string;
  title: string;
  content: string;
  slug: string;
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

async function failActiveJobPosts(jobId: string, message: string, modelId?: string | null) {
  await prisma.post.updateMany({
    where: {
      summaryJobId: jobId,
      summaryStatus: { in: ACTIVE_SUMMARY_STATUSES },
    },
    data: {
      summaryStatus: POST_SUMMARY_STATUSES.failed,
      summaryError: message,
      summaryModelId: modelId ?? null,
    },
  });
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
    select: { id: true, title: true, content: true },
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
      await markAiTaskRunning(task.id);
    }

    const aiModel = await getAiModelForCapability("post-summary", modelId);
    if (!aiModel?.apiKey) {
      await failActiveJobPosts(jobId, aiModel ? `${aiModel.apiKeyEnv} is not configured` : "AI model is not available for post summaries", modelId);
      if (task) {
        for (const item of task.items) {
          await markAiTaskItemFailed(item.id, aiModel ? `${aiModel.apiKeyEnv} is not configured` : "AI model is not available for post summaries");
        }
      }
      return;
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
        slug: true,
        category: { select: { slug: true } },
        tags: { where: { deletedAt: null }, select: { slug: true } },
      },
      orderBy: { createdAt: "asc" },
    })) as SummaryPost[];

    for (const post of posts) {
      const taskItemId = taskItemsByPostId.get(post.id);

      if (taskItemId) {
        await markAiTaskItemRunning(taskItemId);
      }

      await prisma.post.updateMany({
        where: {
          id: post.id,
          summaryJobId: jobId,
          summaryStatus: { in: ACTIVE_SUMMARY_STATUSES },
        },
        data: {
          summaryStatus: POST_SUMMARY_STATUSES.generating,
          summaryError: null,
          summaryModelId: aiModel.id,
        },
      });

      const content = post.content.trim();
      if (!content) {
        await prisma.post.update({
          where: { id: post.id },
          data: {
            summaryStatus: POST_SUMMARY_STATUSES.failed,
            summaryError: "Article content is required",
            summaryModelId: aiModel.id,
          },
          select: { id: true },
        });
        if (taskItemId) {
          await markAiTaskItemFailed(taskItemId, "Article content is required");
        }
        continue;
      }

      try {
        const excerpt = await generatePostSummary({ aiModel, title: post.title, content });
        await prisma.post.update({
          where: { id: post.id },
          data: {
            excerpt,
            summaryStatus: POST_SUMMARY_STATUSES.generated,
            summaryError: null,
            summaryGeneratedAt: new Date(),
            summaryModelId: aiModel.id,
          },
          select: { id: true },
        });
        if (taskItemId) {
          await markAiTaskItemSucceeded(taskItemId, { summary: excerpt }, true);
        }

        revalidatePublicContent({
          slug: post.slug,
          categorySlug: post.category?.slug,
          tagSlugs: post.tags.map((tag) => tag.slug),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Summary generation failed";
        await prisma.post.update({
          where: { id: post.id },
          data: {
            summaryStatus: POST_SUMMARY_STATUSES.failed,
            summaryError: message,
            summaryModelId: aiModel.id,
          },
          select: { id: true },
        });
        if (taskItemId) {
          await markAiTaskItemFailed(taskItemId, message);
        }
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
