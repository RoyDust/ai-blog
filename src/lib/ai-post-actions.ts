/**
 * 单篇文章 AI 动作编排层。
 *
 * 职责：
 * - 为文章或草稿提供摘要、SEO、标题、slug、标签、分类、封面等 AI 能力
 * - 统一封装模型调用输入上下文
 * - 生成 AI 任务快照，并把成功结果应用回文章
 *
 * 说明：
 * - 这里负责“动作路由与结果归一化”
 * - 真正的摘要生成、生图、任务记录等能力分别在其他模块中实现
 */
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { generateAiCoverImage } from "@/lib/ai-cover-image";
import { getAiModelChatRequestExtras, getAiModelForCapability, type AiModelOption } from "@/lib/ai-models";
import { createCompletionClientForModel } from "@/lib/openai-compatible-completion-client";
import {
  buildCategoryPrompt,
  buildPostAiBaseContext,
  buildSeoDescriptionPrompt,
  buildSlugPrompt,
  buildTagsPrompt,
  buildTitlePrompt,
  parseJsonObject,
  resolveExistingTagsFromAiOutput,
  toStringArray,
} from "@/lib/ai-post-actions-prompts";
import { AI_TASK_ITEM_STATUSES, isAiTaskActive, lockAiTask, refreshAiTaskCountsInTransaction, type JsonValue } from "@/lib/ai-tasks";
import { ApiError, ConflictError, NotFoundError, ValidationError } from "@/lib/api-errors";
import { getPublicContentPaths, revalidatePublicContentStrict } from "@/lib/cache";
import { generatePostSummary, getPostSummaryMaxInputChars } from "@/lib/post-summary";
import { getSummaryFieldsForExcerpt } from "@/lib/post-summary-status";
import { prisma } from "@/lib/prisma";
import { withAiInfrastructure } from "@/lib/ai-task-errors";
import { generatePostSlug } from "@/lib/slug";
import { parsePostPatchInput, parsePostSlug } from "@/lib/validation";

/**
 * 后台文章支持的 AI 动作枚举。
 * 前后端都应尽量复用这里的常量，避免 action 字符串漂移。
 */
export const POST_AI_ACTIONS = {
  summary: "summary",
  seoDescription: "seo-description",
  title: "title",
  slug: "slug",
  tags: "tags",
  category: "category",
  coverImage: "cover-image",
} as const;

export type PostAiAction = (typeof POST_AI_ACTIONS)[keyof typeof POST_AI_ACTIONS];

export type PostForAi = {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  seoDescription: string | null;
  category: { id: string; name: string; slug: string } | null;
  tags: Array<{ id: string; name: string; slug: string }>;
  published: boolean;
  coverImage?: string | null;
  authorId?: string;
  coverAssetId?: string | null;
  summaryJobId?: string | null;
  series?: { slug: string } | null;
};

export type DraftPostForAiInput = {
  title?: unknown;
  slug?: unknown;
  content?: unknown;
  excerpt?: unknown;
  seoDescription?: unknown;
  categoryId?: unknown;
  tagIds?: unknown;
};

function normalizeAction(action: string): PostAiAction {
  const normalized = action.replace(/^generate-/, "").replace(/-suggestion$/, "");

  if (Object.values(POST_AI_ACTIONS).includes(normalized as PostAiAction)) {
    return normalized as PostAiAction;
  }

  throw new ValidationError("Unsupported AI action");
}

function readOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function truncateContent(content: string) {
  const normalized = content.trim();
  const maxChars = getPostSummaryMaxInputChars();

  return normalized.length > maxChars ? `${normalized.slice(0, maxChars)}\n\n[内容已截取]` : normalized;
}

async function getDefaultActionModel(modelId?: string | null) {
  const model = await getAiModelForCapability("post-summary", modelId);

  if (!model) {
    throw new ValidationError("AI model is not available");
  }

  if (!model.apiKey) {
    throw new ApiError(500, `${model.apiKeyEnv} is not configured`);
  }

  return model;
}

async function runChatText({
  aiModel,
  system,
  user,
  maxTokens = 500,
}: {
  aiModel: AiModelOption;
  system: string;
  user: string;
  maxTokens?: number;
}) {
  const client = createCompletionClientForModel(aiModel)
  const result = await client.completeText([
    { role: "system", content: system },
    { role: "user", content: user },
  ], {
    strategy: "interactive-completion",
    bodyExtensions: {
      ...getAiModelChatRequestExtras(aiModel),
      temperature: 0.25,
      max_tokens: maxTokens,
    },
  })

  if (!result.text.trim()) {
    throw new Error("AI returned empty output")
  }

  return result.text
}
/**
 * 读取单篇正式文章，构造 AI 动作所需上下文。
 */
export async function getPostForAiAction(postId: string, client: Pick<Prisma.TransactionClient, "post"> = prisma): Promise<PostForAi> {
  const post = await client.post.findFirst({
    where: { id: postId, deletedAt: null },
    select: {
      id: true,
      title: true,
      slug: true,
      content: true,
      excerpt: true,
      seoDescription: true,
      published: true,
      coverImage: true,
      coverAssetId: true,
      summaryJobId: true,
      authorId: true,
      series: { select: { slug: true } },
      category: { select: { id: true, name: true, slug: true } },
      tags: { where: { deletedAt: null }, select: { id: true, name: true, slug: true } },
    },
  });

  if (!post) {
    throw new NotFoundError("Post not found");
  }

  return post;
}

/**
 * 把尚未落库的编辑器草稿拼装成 AI 可消费的文章上下文。
 * 这样摘要、分类建议、标签建议等动作可以在“未保存草稿”阶段提前运行。
 */
export async function buildDraftPostForAiAction(input: DraftPostForAiInput): Promise<PostForAi> {
  const title = readOptionalString(input.title) || "未命名草稿";
  const content = readOptionalString(input.content);

  if (!content) {
    throw new ValidationError("Post content is required for AI action");
  }

  const categoryId = readOptionalString(input.categoryId);
  const tagIds = readStringArray(input.tagIds);
  const [category, tags] = await Promise.all([
    categoryId
      ? prisma.category.findFirst({
          where: { id: categoryId, deletedAt: null },
          select: { id: true, name: true, slug: true },
        })
      : Promise.resolve(null),
    tagIds.length > 0
      ? prisma.tag.findMany({
          where: { id: { in: tagIds }, deletedAt: null },
          select: { id: true, name: true, slug: true },
        })
      : Promise.resolve([]),
  ]);

  return {
    id: "draft",
    title,
    slug: generatePostSlug(readOptionalString(input.slug) || title) || "draft",
    content,
    excerpt: readOptionalString(input.excerpt) || null,
    seoDescription: readOptionalString(input.seoDescription) || null,
    category,
    tags,
    published: false,
    coverImage: null,
  };
}

/**
 * 把文章 AI 动作映射为统一任务类型，便于任务中心统计与重试。
 */
export function getAiTaskTypeForAction(action: PostAiAction) {
  if (action === POST_AI_ACTIONS.summary) return "post-summary";
  if (action === POST_AI_ACTIONS.seoDescription) return "post-seo-description";
  if (action === POST_AI_ACTIONS.title) return "post-title-suggestion";
  if (action === POST_AI_ACTIONS.slug) return "post-slug-suggestion";
  if (action === POST_AI_ACTIONS.tags) return "post-tag-suggestion";
  if (action === POST_AI_ACTIONS.category) return "post-category-suggestion";
  if (action === POST_AI_ACTIONS.coverImage) return "post-cover-image";
  return "post-category-suggestion";
}

/**
 * 为 AI 任务记录生成输入快照。
 * 快照用于审计、重试与详情页展示，不追求完整正文，只保留关键定位字段。
 */
export function buildPostAiInputSnapshot(post: PostForAi, action: PostAiAction): JsonValue {
  return {
    postId: post.id,
    authorId: post.authorId ?? null,
    contentHash: createHash("sha256").update(post.content).digest("hex"),
    title: post.title,
    slug: post.slug,
    action,
    excerpt: post.excerpt,
    seoDescription: post.seoDescription,
    coverImage: post.coverImage ?? null,
    coverAssetId: post.coverAssetId ?? null,
    summaryJobId: post.summaryJobId ?? null,
    published: post.published,
    seriesSlug: post.series?.slug ?? null,
    contentLength: post.content.length,
    categorySlug: post.category?.slug ?? null,
    categoryId: post.category?.id ?? null,
    categoryName: post.category?.name ?? null,
    tagNames: post.tags.map((tag) => tag.name).sort(),
    tagIds: post.tags.map((tag) => tag.id).sort(),
    tagSlugs: post.tags.map((tag) => tag.slug).sort(),
  };
}

/**
 * 执行单个文章 AI 动作。
 *
 * 输出约定：
 * - 始终返回 action、实际使用的 modelId 以及归一化后的 output
 * - 不直接写回文章，写回动作交由 applyPostAiTaskItem 统一处理
 */
export async function runPostAiAction({
  post,
  action,
  modelId,
}: {
  post: PostForAi;
  action: string;
  modelId?: string | null;
}) {
  const normalizedAction = normalizeAction(action);
  const aiModel = await withAiInfrastructure(() => getDefaultActionModel(modelId));

  if (normalizedAction === POST_AI_ACTIONS.summary) {
    return {
      action: normalizedAction,
      modelId: aiModel.id,
      output: {
        summary: await generatePostSummary({ aiModel, title: post.title, content: post.content }),
      },
    };
  }

  if (normalizedAction === POST_AI_ACTIONS.coverImage) {
    const asset = await generateAiCoverImage({
      title: post.title,
      excerpt: post.excerpt,
      content: post.content,
      modelId,
      size: "16:9",
      createdById: "system",
    });

    return {
      action: normalizedAction,
      modelId: asset.aiModelId ?? modelId ?? null,
      output: {
        coverAssetId: asset.id,
        coverImage: asset.url,
        alt: asset.alt,
      },
    };
  }

  const content = truncateContent(post.content);
  const baseContext = buildPostAiBaseContext(post, content);

  if (normalizedAction === POST_AI_ACTIONS.seoDescription) {
    const text = await runChatText({
      aiModel,
      system: "你是博客 SEO 编辑，输出必须简洁、具体、自然。",
      user: buildSeoDescriptionPrompt(baseContext),
      maxTokens: 260,
    });

    return {
      action: normalizedAction,
      modelId: aiModel.id,
      output: { seoDescription: text.replace(/^['"“”‘’\s]+|['"“”‘’\s]+$/g, "").trim() },
    };
  }

  if (normalizedAction === POST_AI_ACTIONS.title) {
    const text = await runChatText({
      aiModel,
      system: "你是博客标题编辑，输出必须是 JSON。",
      user: buildTitlePrompt(baseContext),
      maxTokens: 360,
    });
    const parsed = parseJsonObject(text);
    const titles = toStringArray(parsed?.titles ?? text).slice(0, 3);

    if (titles.length === 0) {
      throw new Error("AI returned no title suggestions");
    }

    return {
      action: normalizedAction,
      modelId: aiModel.id,
      output: { titles },
    };
  }

  if (normalizedAction === POST_AI_ACTIONS.slug) {
    const text = await runChatText({
      aiModel,
      system: "你是 URL slug 生成器，只输出短横线连接的英文或拼音 slug。",
      user: buildSlugPrompt(baseContext),
      maxTokens: 120,
    });
    const slug = generatePostSlug(text || post.title);

    return {
      action: normalizedAction,
      modelId: aiModel.id,
      output: { slug },
    };
  }

  if (normalizedAction === POST_AI_ACTIONS.tags) {
    const tags = await withAiInfrastructure(() => prisma.tag.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    }));

    if (tags.length === 0) {
      throw new ValidationError("No existing tags available for AI selection");
    }

    const text = await runChatText({
      aiModel,
      system: "你是博客信息架构助手，输出必须是 JSON。",
      user: buildTagsPrompt(tags, baseContext),
      maxTokens: 360,
    });
    const parsed = parseJsonObject(text);
    const selectedTags = resolveExistingTagsFromAiOutput({ parsed, fallbackText: text, tags });

    if (selectedTags.length === 0) {
      throw new Error("AI tag output did not match existing tags");
    }

    return {
      action: normalizedAction,
      modelId: aiModel.id,
      output: {
        existingTagIds: selectedTags.map((tag) => tag.id),
        tagSlugs: selectedTags.map((tag) => tag.slug),
        names: selectedTags.map((tag) => tag.name),
        newTagNames: [],
      },
    };
  }

  const categories = await withAiInfrastructure(() => prisma.category.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  }));
  const text = await runChatText({
    aiModel,
    system: "你是博客分类助手，输出必须是 JSON。",
    user: buildCategoryPrompt(categories, baseContext),
    maxTokens: 220,
  });
  const parsed = parseJsonObject(text);
  const categoryHint = typeof parsed?.categorySlug === "string" ? parsed.categorySlug : text.trim();
  const category = categories.find(
    (item) => item.slug.toLowerCase() === categoryHint.toLowerCase() || item.name.toLowerCase() === categoryHint.toLowerCase(),
  );

  return {
    action: normalizedAction,
    modelId: aiModel.id,
    output: {
      categoryId: category?.id ?? null,
      categoryName: category?.name ?? null,
      categorySlug: category?.slug ?? null,
      reason: typeof parsed?.reason === "string" ? parsed.reason : null,
    },
  };
}

/**
 * Narrows persisted task output before it is applied back to a post.
 */
function readOutputObject(output: unknown) {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    throw new ValidationError("AI task output is invalid");
  }

  return output as Record<string, unknown>;
}

/** Validate both automatic and manual applications through one field contract. */
async function postAiUpdate(client: Prisma.TransactionClient, post: PostForAi, action: PostAiAction, value: unknown, modelId: string | null) {
  const output = readOutputObject(value);
  const data: Prisma.PostUncheckedUpdateManyInput = {};
  let tagIds: string[] | null = null;
  if (action === POST_AI_ACTIONS.summary) {
    const summary = typeof output.summary === "string" ? output.summary.trim() : "";
    if (!summary) throw new ValidationError("AI summary output is invalid");
    Object.assign(data, { excerpt: summary, ...getSummaryFieldsForExcerpt(summary), summaryModelId: modelId, summaryJobId: null });
  } else if (action === POST_AI_ACTIONS.seoDescription) {
    const seoDescription = typeof output.seoDescription === "string" ? output.seoDescription.trim() : "";
    if (!seoDescription) throw new ValidationError("AI SEO output is invalid");
    Object.assign(data, { seoDescription, seoGeneratedAt: new Date(), seoModelId: modelId });
  } else if (action === POST_AI_ACTIONS.title) {
    const titles = toStringArray(output.titles);
    if (titles.length === 0) throw new ValidationError("AI title output is invalid");
    data.title = titles[0];
  } else if (action === POST_AI_ACTIONS.slug) {
    data.slug = parsePostSlug(output.slug);
  } else if (action === POST_AI_ACTIONS.category) {
    const categoryId = typeof output.categoryId === "string" ? output.categoryId : null;
    if (!categoryId || !await client.category.findFirst({ where: { id: categoryId, deletedAt: null }, select: { id: true } })) {
      throw new ValidationError("AI category output did not match an existing category");
    }
    data.categoryId = categoryId;
  } else if (action === POST_AI_ACTIONS.coverImage) {
    const coverImage = typeof output.coverImage === "string" ? output.coverImage.trim() : "";
    const coverAssetId = typeof output.coverAssetId === "string" ? output.coverAssetId.trim() : "";
    if (!coverImage || !coverAssetId || !await client.coverAsset.findFirst({ where: { id: coverAssetId, url: coverImage, deletedAt: null }, select: { id: true } })) {
      throw new ValidationError("AI cover output is invalid");
    }
    Object.assign(data, { coverImage, coverAssetId });
  } else if (action === POST_AI_ACTIONS.tags) {
    tagIds = [...new Set(toStringArray(output.existingTagIds))];
    if (tagIds.length === 0) throw new ValidationError("AI tag output did not match existing tags");
    const tags = await client.tag.findMany({ where: { id: { in: tagIds }, deletedAt: null }, select: { id: true } });
    if (tags.length !== tagIds.length) throw new ValidationError("AI tag output did not match existing tags");
  }
  parsePostPatchInput({ title: post.title, content: post.content, ...data });
  return { data, tagIds };
}

function sameSnapshot(left: unknown, right: unknown): boolean {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)]));
    return value;
  };
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

export function canAutoApplyPostAiAction(action: PostAiAction, apply: boolean) {
  return apply && (action === POST_AI_ACTIONS.summary || action === POST_AI_ACTIONS.seoDescription || action === POST_AI_ACTIONS.coverImage);
}

async function writePostAiUpdate(client: Prisma.TransactionClient, post: PostForAi, update: Awaited<ReturnType<typeof postAiUpdate>>) {
  const changed = await client.post.updateMany({
    where: { id: post.id, deletedAt: null, authorId: post.authorId },
    data: { ...update.data, updatedAt: new Date() },
  });
  if (changed.count !== 1) throw new ConflictError("文章在应用时发生变化");
  if (update.tagIds) await client.post.update({ where: { id: post.id }, data: { tags: { set: update.tagIds.map((id) => ({ id })) } } });
  return getPostForAiAction(post.id, client);
}

function revalidatePostAiChange(previous: PostForAi, current: PostForAi, context: { taskId: string; itemId: string }) {
  const logContext = { ...context, postId: current.id };
  let paths: string[] = [];
  try {
    const options = {
      slug: current.published ? current.slug : null, previousSlug: previous.published ? previous.slug : null,
      categorySlug: current.published ? current.category?.slug : null, previousCategorySlug: previous.published ? previous.category?.slug : null,
      tagSlugs: current.published ? current.tags.map((tag) => tag.slug) : [], previousTagSlugs: previous.published ? previous.tags.map((tag) => tag.slug) : [],
      seriesSlug: current.published ? current.series?.slug : null, previousSeriesSlug: previous.published ? previous.series?.slug : null,
    };
    paths = getPublicContentPaths(options);
    const report = revalidatePublicContentStrict(options);
    if (report.errors.length) console.error("AI content cache refresh incomplete:", { ...logContext, ...report });
    return report;
  } catch (error) {
    const report = { paths, errors: [{ path: "*", error: error instanceof Error ? error.message : "Cache refresh failed" }] };
    console.error("AI content cache refresh failed:", { ...logContext, ...report, error });
    return report;
  }
}

/** Model calls happen before this transaction; infrastructure failures leave the item active. */
export async function completePostAiTaskItem(input: {
  taskId: string; itemId: string; post: PostForAi; action: PostAiAction; expectedInputSnapshot: JsonValue | null;
  output: JsonValue; modelId: string | null; apply: boolean;
}) {
  const committed = await prisma.$transaction(async (client) => {
    const task = await lockAiTask(client, input.taskId);
    if (!isAiTaskActive(task.status)) return null;
    await client.$queryRawUnsafe('SELECT id FROM ai_task_items WHERE id = $1 FOR UPDATE', input.itemId);
    const item = await client.aiTaskItem.findUnique({ where: { id: input.itemId } });
    if (!item || item.taskId !== task.id || !isAiTaskActive(item.status)) return null;
    const snapshot = buildPostAiInputSnapshot(input.post, input.action);
    let conflict = item.postId !== input.post.id || item.action !== input.action || !sameSnapshot(item.inputSnapshot, input.expectedInputSnapshot);
    let current: PostForAi | null = null;
    if (!conflict) {
      await client.$queryRawUnsafe('SELECT id FROM posts WHERE id = $1 FOR UPDATE', input.post.id);
      try { current = await getPostForAiAction(input.post.id, client); }
      catch (error) { if (!(error instanceof NotFoundError)) throw error; }
      conflict = !current || !sameSnapshot(buildPostAiInputSnapshot(current, input.action), snapshot);
    }
    const apply = !conflict && canAutoApplyPostAiAction(input.action, input.apply);
    let updated: PostForAi | null = null;
    if (apply && current) updated = await writePostAiUpdate(client, current, await postAiUpdate(client, current, input.action, input.output, input.modelId));
    const changed = await client.aiTaskItem.updateMany({
      where: { id: item.id, taskId: task.id, status: { in: [AI_TASK_ITEM_STATUSES.queued, AI_TASK_ITEM_STATUSES.running] } },
      data: {
        status: conflict ? AI_TASK_ITEM_STATUSES.skipped : AI_TASK_ITEM_STATUSES.succeeded,
        output: input.output as Prisma.InputJsonValue, inputSnapshot: snapshot as Prisma.InputJsonValue,
        applied: apply, error: conflict ? "生成期间文章、目标字段或任务归属发生变化，已跳过旧结果" : null, finishedAt: new Date(),
      },
    });
    if (changed.count !== 1) throw new ConflictError("AI task item changed during completion");
    if (input.modelId && !task.modelId) await client.aiTask.update({ where: { id: task.id }, data: { modelId: input.modelId } });
    await refreshAiTaskCountsInTransaction(client, task.id);
    return { status: conflict ? AI_TASK_ITEM_STATUSES.skipped : AI_TASK_ITEM_STATUSES.succeeded, applied: apply, post: updated, previous: current };
  });
  if (committed?.post && committed.previous) return { ...committed, cache: revalidatePostAiChange(committed.previous, committed.post, { taskId: input.taskId, itemId: input.itemId }) };
  return committed;
}

/** Manual apply only changes the post and applied flag; completion delivery stays immutable. */
export async function applyPostAiTaskItem(itemId: string) {
  const initial = await prisma.aiTaskItem.findUnique({ where: { id: itemId }, select: { taskId: true } });
  if (!initial) throw new NotFoundError("AI task item not found");
  const committed = await prisma.$transaction(async (client) => {
    const task = await lockAiTask(client, initial.taskId);
    await client.$queryRawUnsafe('SELECT id FROM ai_task_items WHERE id = $1 FOR UPDATE', itemId);
    const item = await client.aiTaskItem.findUnique({ where: { id: itemId } });
    if (!item || item.taskId !== task.id) throw new ConflictError("AI task item ownership changed");
    if (item.status !== AI_TASK_ITEM_STATUSES.succeeded) throw new ValidationError("Only successful AI task items can be applied");
    if (!item.postId) throw new ValidationError("AI task item is not linked to a post");
    await client.$queryRawUnsafe('SELECT id FROM posts WHERE id = $1 FOR UPDATE', item.postId);
    const current = await getPostForAiAction(item.postId, client);
    if (item.applied) return { post: current, previous: null };
    const action = normalizeAction(item.action);
    const snapshot = readOutputObject(item.inputSnapshot);
    const currentSnapshot = buildPostAiInputSnapshot(current, action) as Record<string, JsonValue>;
    if (!snapshot.contentHash || !snapshot.authorId || !Object.entries(currentSnapshot).every(([key, value]) => sameSnapshot(snapshot[key], value))) {
      throw new ConflictError("生成输入已变化或快照不完整，请重新生成建议");
    }
    const updated = await writePostAiUpdate(client, current, await postAiUpdate(client, current, action, item.output, task.modelId));
    const changed = await client.aiTaskItem.updateMany({ where: { id: item.id, taskId: task.id, postId: current.id, status: AI_TASK_ITEM_STATUSES.succeeded, applied: false }, data: { applied: true } });
    if (changed.count !== 1) throw new ConflictError("AI task item changed during apply");
    return { post: updated, previous: current };
  });
  if (committed.previous) revalidatePostAiChange(committed.previous, committed.post, { taskId: initial.taskId, itemId });
  return committed.post;
}

export { normalizeAction as normalizePostAiAction };
