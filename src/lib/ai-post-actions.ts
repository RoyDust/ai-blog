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
import { generateAiCoverImage } from "@/lib/ai-cover-image";
import { getAiModelChatRequestExtras, getAiModelForCapability, type AiModelOption } from "@/lib/ai-models";
import {
  buildCategoryPrompt,
  buildPostAiBaseContext,
  buildSeoDescriptionPrompt,
  buildSlugPrompt,
  buildTagsPrompt,
  buildTitlePrompt,
  extractChatText,
  parseJsonObject,
  resolveExistingTagsFromAiOutput,
  toStringArray,
  type ChatPayload,
} from "@/lib/ai-post-actions-prompts";
import { AI_TASK_ITEM_STATUSES, getAiTaskItem, markAiTaskItemSucceeded, type JsonValue } from "@/lib/ai-tasks";
import { ApiError, NotFoundError, ValidationError } from "@/lib/api-errors";
import { revalidatePublicContent } from "@/lib/cache";
import { generatePostSummary, getPostSummaryMaxInputChars, getPostSummaryTimeoutMs } from "@/lib/post-summary";
import { getSummaryFieldsForExcerpt } from "@/lib/post-summary-status";
import { prisma } from "@/lib/prisma";
import { generatePostSlug } from "@/lib/slug";

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
  let response: Response;

  try {
    response = await fetch(`${aiModel.baseUrl}${aiModel.requestPath}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aiModel.apiKey}`,
      },
      body: JSON.stringify({
        model: aiModel.model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.25,
        max_tokens: maxTokens,
        ...getAiModelChatRequestExtras(aiModel),
      }),
      signal: AbortSignal.timeout(getPostSummaryTimeoutMs()),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI request failed";
    throw new Error(message.includes("timeout") || message.includes("aborted") ? "AI 操作超时，请稍后重试或切换更快的模型。" : message);
  }

  const payload = (await response.json().catch(() => ({}))) as ChatPayload;

  if (!response.ok) {
    throw new Error(payload.error?.message || "AI request failed");
  }

  const text = extractChatText(payload);
  if (!text) {
    throw new Error("AI returned empty output");
  }

  return text;
}

/**
 * 读取单篇正式文章，构造 AI 动作所需上下文。
 */
export async function getPostForAiAction(postId: string): Promise<PostForAi> {
  const post = await prisma.post.findFirst({
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
    title: post.title,
    slug: post.slug,
    action,
    excerpt: post.excerpt,
    seoDescription: post.seoDescription,
    coverImage: post.coverImage ?? null,
    contentLength: post.content.length,
    categorySlug: post.category?.slug ?? null,
    tagSlugs: post.tags.map((tag) => tag.slug),
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
  const aiModel = await getDefaultActionModel(modelId);

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
    const tags = await prisma.tag.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    });

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

  const categories = await prisma.category.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, slug: true },
    orderBy: { name: "asc" },
  });
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

/**
 * 把已成功生成的 AI 任务结果应用到文章。
 *
 * 这里会根据 action 类型把 output 解析成数据库更新数据，
 * 并在文章已发布时刷新前台缓存。
 */
export async function applyPostAiTaskItem(itemId: string) {
  const item = await getAiTaskItem(itemId);

  if (!item.postId || !item.post) {
    throw new ValidationError("AI task item is not linked to a post");
  }

  if (item.status !== AI_TASK_ITEM_STATUSES.succeeded) {
    throw new ValidationError("Only successful AI task items can be applied");
  }

  const output = readOutputObject(item.output);
  const action = normalizeAction(item.action);
  const data: Record<string, unknown> = {};

  if (action === POST_AI_ACTIONS.summary) {
    const summary = typeof output.summary === "string" ? output.summary.trim() : "";
    if (!summary) throw new ValidationError("AI summary output is invalid");
    Object.assign(data, { excerpt: summary, ...getSummaryFieldsForExcerpt(summary), summaryModelId: item.task.modelId });
  } else if (action === POST_AI_ACTIONS.seoDescription) {
    const seoDescription = typeof output.seoDescription === "string" ? output.seoDescription.trim() : "";
    if (!seoDescription) throw new ValidationError("AI SEO output is invalid");
    Object.assign(data, { seoDescription, seoGeneratedAt: new Date(), seoModelId: item.task.modelId });
  } else if (action === POST_AI_ACTIONS.title) {
    const titles = toStringArray(output.titles);
    if (titles.length === 0) throw new ValidationError("AI title output is invalid");
    data.title = titles[0];
  } else if (action === POST_AI_ACTIONS.slug) {
    const slug = typeof output.slug === "string" ? generatePostSlug(output.slug) : "";
    if (!slug) throw new ValidationError("AI slug output is invalid");
    data.slug = slug;
  } else if (action === POST_AI_ACTIONS.category) {
    data.categoryId = typeof output.categoryId === "string" ? output.categoryId : null;
  } else if (action === POST_AI_ACTIONS.coverImage) {
    const coverImage = typeof output.coverImage === "string" ? output.coverImage.trim() : "";
    const coverAssetId = typeof output.coverAssetId === "string" ? output.coverAssetId.trim() : "";
    if (!coverImage || !coverAssetId) throw new ValidationError("AI cover output is invalid");
    Object.assign(data, { coverImage, coverAssetId });
  }

  const tagIds = action === POST_AI_ACTIONS.tags ? toStringArray(output.existingTagIds) : null;

  if (action === POST_AI_ACTIONS.tags && (!tagIds || tagIds.length === 0)) {
    throw new ValidationError("AI tag output did not match existing tags");
  }

  const updated = await prisma.post.update({
    where: { id: item.postId },
    data: {
      ...data,
      ...(tagIds ? { tags: { set: tagIds.map((id) => ({ id })) } } : {}),
    },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      seoDescription: true,
      published: true,
      category: { select: { id: true, name: true, slug: true } },
      tags: { where: { deletedAt: null }, select: { id: true, name: true, slug: true } },
    },
  });

  await markAiTaskItemSucceeded(item.id, item.output as JsonValue, true);

  revalidatePublicContent({
    slug: updated.published ? updated.slug : null,
    categorySlug: updated.published ? updated.category?.slug : null,
    tagSlugs: updated.published ? updated.tags.map((tag) => tag.slug) : [],
  });

  return updated;
}

export { normalizeAction as normalizePostAiAction };
