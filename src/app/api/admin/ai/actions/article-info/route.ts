import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import {
  POST_AI_ACTIONS,
  buildDraftPostForAiAction,
  buildPostAiInputSnapshot,
  getPostForAiAction,
  runPostAiAction,
  type DraftPostForAiInput,
  type PostAiAction,
  type PostForAi,
} from "@/lib/ai-post-actions";
import {
  AI_TASK_ITEM_STATUSES,
  createAiTask,
  markAiTaskItemFailed,
  markAiTaskItemRunning,
  markAiTaskItemSucceeded,
  markAiTaskRunning,
  refreshAiTaskCounts,
  type JsonValue,
} from "@/lib/ai-tasks";
import { toErrorResponse, ValidationError } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
import { generatePostSlug } from "@/lib/slug";

const ARTICLE_INFO_ACTIONS = [
  POST_AI_ACTIONS.slug,
  POST_AI_ACTIONS.summary,
  POST_AI_ACTIONS.seoDescription,
  POST_AI_ACTIONS.category,
  POST_AI_ACTIONS.tags,
] satisfies PostAiAction[];
const ARTICLE_INFO_PROMPT_VERSION = "post-article-info-v1";
const ARTICLE_INFO_MIN_CONTENT_CHARS = 20;

type Body = {
  postId?: unknown;
  draft?: DraftPostForAiInput;
  modelId?: string;
};

type ArticleInfoQualityCheck = {
  key: string;
  label: string;
  status: "ok" | "warning" | "danger";
  message: string;
};

function readOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readOutputObject(output: unknown) {
  return output && typeof output === "object" && !Array.isArray(output) ? (output as Record<string, unknown>) : {};
}

function readStringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function getMeaningfulContentLength(content: string) {
  return content.replace(/[#*_`>\-[\]()\s，。！？、,.!?]/g, "").trim().length;
}

function assertEnoughContentForArticleInfo(post: PostForAi) {
  if (getMeaningfulContentLength(post.content) < ARTICLE_INFO_MIN_CONTENT_CHARS) {
    throw new ValidationError(`正文至少需要 ${ARTICLE_INFO_MIN_CONTENT_CHARS} 个有效字符后再使用一键 AI 生成`);
  }
}

function withOutputMeta(output: unknown, meta: Record<string, JsonValue>) {
  return {
    ...readOutputObject(output),
    _meta: meta,
  };
}

function normalizeArticleInfo(outputs: Partial<Record<PostAiAction, unknown>>) {
  const slugOutput = readOutputObject(outputs[POST_AI_ACTIONS.slug]);
  const summaryOutput = readOutputObject(outputs[POST_AI_ACTIONS.summary]);
  const seoOutput = readOutputObject(outputs[POST_AI_ACTIONS.seoDescription]);
  const categoryOutput = readOutputObject(outputs[POST_AI_ACTIONS.category]);
  const tagsOutput = readOutputObject(outputs[POST_AI_ACTIONS.tags]);

  const rawSlug = readOptionalString(slugOutput.slug);
  const slug = rawSlug ? generatePostSlug(rawSlug) : "";
  const excerpt = readOptionalString(summaryOutput.summary);
  const seoDescription = readOptionalString(seoOutput.seoDescription);

  return {
    slug,
    excerpt,
    seoDescription,
    categoryId: readOptionalString(categoryOutput.categoryId),
    categoryName: readOptionalString(categoryOutput.categoryName),
    categorySlug: readOptionalString(categoryOutput.categorySlug),
    tagIds: readStringList(tagsOutput.existingTagIds),
    tagNames: readStringList(tagsOutput.names),
    tagSlugs: readStringList(tagsOutput.tagSlugs),
  };
}

function hasRequiredArticleInfo(articleInfo: ReturnType<typeof normalizeArticleInfo>) {
  return Boolean(articleInfo.slug && articleInfo.excerpt && articleInfo.seoDescription);
}

async function findSlugConflict(slug: string, postId: string | null) {
  if (!slug) return null;

  return prisma.post.findFirst({
    where: {
      slug,
      deletedAt: null,
      ...(postId ? { NOT: { id: postId } } : {}),
    },
    select: { id: true, title: true },
  });
}

async function buildArticleInfoQuality({
  articleInfo,
  post,
  postId,
}: {
  articleInfo: ReturnType<typeof normalizeArticleInfo>;
  post: PostForAi;
  postId: string | null;
}) {
  const checks: ArticleInfoQualityCheck[] = [];
  const slugConflict = await findSlugConflict(articleInfo.slug, postId);

  checks.push(
    articleInfo.slug && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(articleInfo.slug) && articleInfo.slug.length <= 60
      ? { key: "slug-format", label: "Slug 可读性", status: "ok", message: "格式可用于公开 URL。" }
      : { key: "slug-format", label: "Slug 可读性", status: "danger", message: "Slug 为空或格式不适合公开 URL。" },
  );

  checks.push(
    slugConflict
      ? { key: "slug-unique", label: "Slug 唯一性", status: "danger", message: `已被《${slugConflict.title}》使用，应用时会保留原 Slug。` }
      : { key: "slug-unique", label: "Slug 唯一性", status: articleInfo.slug ? "ok" : "warning", message: articleInfo.slug ? "未发现重复 Slug。" : "未生成 Slug。" },
  );

  const seoLength = articleInfo.seoDescription.length;
  checks.push(
    seoLength >= 70 && seoLength <= 160
      ? { key: "seo-length", label: "SEO 长度", status: "ok", message: "长度处于推荐区间。" }
      : { key: "seo-length", label: "SEO 长度", status: "warning", message: "建议控制在 70-160 个字符。" },
  );

  checks.push(
    articleInfo.excerpt.length >= 30 && articleInfo.excerpt.length <= 180
      ? { key: "summary-coverage", label: "摘要覆盖", status: "ok", message: "摘要长度适合作为列表说明。" }
      : { key: "summary-coverage", label: "摘要覆盖", status: "warning", message: `请确认摘要能覆盖《${post.title}》的核心内容。` },
  );

  checks.push(
    articleInfo.tagIds.length > 0 && articleInfo.tagIds.length <= 5
      ? { key: "tags-count", label: "标签数量", status: "ok", message: `已匹配 ${articleInfo.tagIds.length} 个标签。` }
      : { key: "tags-count", label: "标签数量", status: "warning", message: "建议匹配 1-5 个强相关标签。" },
  );

  const score = checks.reduce((total, check) => total - (check.status === "danger" ? 25 : check.status === "warning" ? 10 : 0), 100);

  return {
    score: Math.max(0, score),
    blockedFields: slugConflict ? ["slug"] : [],
    checks,
  };
}

async function resolvePostInput(body: Body): Promise<{ post: PostForAi; postId: string | null; source: "single-post" | "draft-post" }> {
  const postId = readOptionalString(body.postId);
  const hasDraft = Boolean(body.draft && typeof body.draft === "object");

  if (!postId && !hasDraft) {
    throw new ValidationError("Post id or draft content is required");
  }

  if (hasDraft) {
    const draftPost = await buildDraftPostForAiAction(body.draft ?? {});
    return {
      post: postId ? { ...draftPost, id: postId } : draftPost,
      postId: postId || null,
      source: postId ? "single-post" : "draft-post",
    };
  }

  return {
    post: await getPostForAiAction(postId),
    postId,
    source: "single-post",
  };
}

async function POSTHandler(request: Request) {
  try {
    const session = await requireAdminSession();
    const body = (await request.json()) as Body;
    const { post, postId, source } = await resolvePostInput(body);
    assertEnoughContentForArticleInfo(post);
    const baseMetadata = {
      oneClick: true,
      draft: source === "draft-post",
      preserve: ["title", "content"],
      actions: ARTICLE_INFO_ACTIONS,
      promptVersion: ARTICLE_INFO_PROMPT_VERSION,
    };
    const items = ARTICLE_INFO_ACTIONS.map((action) => ({
      postId,
      action,
      status: AI_TASK_ITEM_STATUSES.queued,
      inputSnapshot: {
        ...(buildPostAiInputSnapshot(post, action) as Record<string, JsonValue>),
        draft: source === "draft-post",
        oneClick: true,
        preserve: ["title", "content"],
      },
    }));
    const task = await createAiTask({
      type: "post-article-info",
      source,
      modelId: body.modelId ?? null,
      createdById: session.user.id,
      metadata: baseMetadata,
      items,
    });
    const outputs: Partial<Record<PostAiAction, unknown>> = {};
    const results: Array<{ itemId: string; action: PostAiAction; modelId: string | null; durationMs: number; output: unknown }> = [];
    const failures: Array<{ action: PostAiAction; message: string; durationMs: number }> = [];
    let resolvedModelId = body.modelId ?? task.modelId ?? null;

    await markAiTaskRunning(task.id);

    for (const action of ARTICLE_INFO_ACTIONS) {
      const item = task.items.find((candidate) => candidate.action === action);

      if (!item) {
        continue;
      }

      await markAiTaskItemRunning(item.id);

      const startedAt = Date.now();
      try {
        const result = await runPostAiAction({ post, action, modelId: body.modelId });
        const durationMs = Date.now() - startedAt;
        if (result.modelId && result.modelId !== resolvedModelId) {
          resolvedModelId = result.modelId;
          await prisma.aiTask.update({ where: { id: task.id }, data: { modelId: result.modelId } });
        }
        const output = withOutputMeta(result.output, {
          modelId: result.modelId ?? null,
          durationMs,
          promptVersion: ARTICLE_INFO_PROMPT_VERSION,
        });
        outputs[action] = output;
        results.push({ itemId: item.id, action, modelId: result.modelId ?? null, durationMs, output });
        await markAiTaskItemSucceeded(item.id, output as JsonValue);
      } catch (error) {
        const durationMs = Date.now() - startedAt;
        const message = error instanceof Error ? error.message : "AI article info item failed";
        failures.push({ action, message, durationMs });
        await markAiTaskItemFailed(item.id, message);
      }
    }

    await refreshAiTaskCounts(task.id);

    const articleInfo = normalizeArticleInfo(outputs);
    const quality = await buildArticleInfoQuality({ articleInfo, post, postId });
    const partial = failures.length > 0 || !hasRequiredArticleInfo(articleInfo);
    const nextMetadata: Record<string, JsonValue> = {
      ...baseMetadata,
      partial,
      failures,
      quality,
      actionMetrics: results.map(({ action, durationMs, modelId }) => ({ action, durationMs, modelId })),
    };

    if (partial) {
      nextMetadata.successfulFields = articleInfo;
    } else {
      nextMetadata.articleInfo = articleInfo;
    }

    await prisma.aiTask.update({
      where: { id: task.id },
      data: { metadata: nextMetadata },
    });

    if (partial) {
      return NextResponse.json(
        {
          success: false,
          error: failures[0]?.message ?? "AI 返回的信息不完整",
          data: {
            taskId: task.id,
            modelId: resolvedModelId,
            partial: true,
            failures,
            quality,
            items: results,
          },
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        taskId: task.id,
        modelId: resolvedModelId,
        articleInfo,
        quality,
        items: results,
      },
    });
  } catch (error) {
    return toErrorResponse(error, "AI article info failed");
  }
}

export const POST = withApiOperationLogging(POSTHandler, {
  scope: "admin",
  operation: "admin.ai.actions.articleinfo.create",
  route: "/api/admin/ai/actions/article-info",
});
