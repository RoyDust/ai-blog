import { getAiModelForCapability, type AiModelOption } from "@/lib/ai-models";
import { AI_TASK_ITEM_STATUSES, getAiTaskItem, markAiTaskItemSucceeded, type JsonValue } from "@/lib/ai-tasks";
import { ApiError, NotFoundError, ValidationError } from "@/lib/api-errors";
import { revalidatePublicContent } from "@/lib/cache";
import { generatePostSummary, getPostSummaryMaxInputChars, getPostSummaryTimeoutMs } from "@/lib/post-summary";
import { getSummaryFieldsForExcerpt } from "@/lib/post-summary-status";
import { prisma } from "@/lib/prisma";
import { generatePostSlug } from "@/lib/slug";

export const POST_AI_ACTIONS = {
  summary: "summary",
  seoDescription: "seo-description",
  title: "title",
  slug: "slug",
  tags: "tags",
  category: "category",
} as const;

export type PostAiAction = (typeof POST_AI_ACTIONS)[keyof typeof POST_AI_ACTIONS];

type ChatPayload = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

type PostForAi = {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  seoDescription: string | null;
  category: { id: string; name: string; slug: string } | null;
  tags: Array<{ id: string; name: string; slug: string }>;
  published: boolean;
};

function normalizeAction(action: string): PostAiAction {
  const normalized = action.replace(/^generate-/, "").replace(/-suggestion$/, "");

  if (Object.values(POST_AI_ACTIONS).includes(normalized as PostAiAction)) {
    return normalized as PostAiAction;
  }

  throw new ValidationError("Unsupported AI action");
}

function extractChatText(payload: ChatPayload) {
  const content = payload.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => item.text?.trim())
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  return "";
}

function parseJsonObject(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const source = fenced ?? trimmed;
  const start = source.indexOf("{");
  const end = source.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    return JSON.parse(source.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function toStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/\r?\n|,|，|、/)
      .map((item) => item.replace(/^[-*\d.\s]+/, "").trim())
      .filter(Boolean);
  }

  return [];
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
      category: { select: { id: true, name: true, slug: true } },
      tags: { where: { deletedAt: null }, select: { id: true, name: true, slug: true } },
    },
  });

  if (!post) {
    throw new NotFoundError("Post not found");
  }

  return post;
}

export function getAiTaskTypeForAction(action: PostAiAction) {
  if (action === POST_AI_ACTIONS.summary) return "post-summary";
  if (action === POST_AI_ACTIONS.seoDescription) return "post-seo-description";
  if (action === POST_AI_ACTIONS.title) return "post-title-suggestion";
  if (action === POST_AI_ACTIONS.slug) return "post-slug-suggestion";
  if (action === POST_AI_ACTIONS.tags) return "post-tag-suggestion";
  return "post-category-suggestion";
}

export function buildPostAiInputSnapshot(post: PostForAi, action: PostAiAction): JsonValue {
  return {
    postId: post.id,
    title: post.title,
    slug: post.slug,
    action,
    excerpt: post.excerpt,
    seoDescription: post.seoDescription,
    contentLength: post.content.length,
    categorySlug: post.category?.slug ?? null,
    tagSlugs: post.tags.map((tag) => tag.slug),
  };
}

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

  const content = truncateContent(post.content);
  const baseContext = [
    `标题：${post.title}`,
    `Slug：${post.slug}`,
    post.excerpt ? `当前摘要：${post.excerpt}` : undefined,
    post.seoDescription ? `当前 SEO 描述：${post.seoDescription}` : undefined,
    post.category ? `当前分类：${post.category.name} (${post.category.slug})` : "当前分类：未分类",
    post.tags.length > 0 ? `当前标签：${post.tags.map((tag) => tag.name).join("、")}` : "当前标签：无",
    `正文：\n${content}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  if (normalizedAction === POST_AI_ACTIONS.seoDescription) {
    const text = await runChatText({
      aiModel,
      system: "你是博客 SEO 编辑，输出必须简洁、具体、自然。",
      user: `请为下面文章生成一段中文 SEO description，80 到 150 个中文字符。只输出描述正文。\n\n${baseContext}`,
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
      user: `请为下面文章给出 3 个中文标题候选。只输出 JSON：{"titles":["标题1","标题2","标题3"]}\n\n${baseContext}`,
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
      user: `请为下面文章生成一个 URL 安全 slug。只输出 slug，不要解释。\n\n${baseContext}`,
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
    const text = await runChatText({
      aiModel,
      system: "你是博客信息架构助手，输出必须是 JSON。",
      user: `请根据文章推荐 3 到 5 个标签，优先从已有标签中选择，也可以建议少量新标签。已有标签：${tags.map((tag) => `${tag.name}(${tag.slug})`).join("、") || "无"}。只输出 JSON：{"tags":["标签1","标签2"]}\n\n${baseContext}`,
      maxTokens: 360,
    });
    const parsed = parseJsonObject(text);
    const names = toStringArray(parsed?.tags ?? text).slice(0, 5);
    const existingTagIds = tags
      .filter((tag) => names.some((name) => name.toLowerCase() === tag.name.toLowerCase() || name.toLowerCase() === tag.slug.toLowerCase()))
      .map((tag) => tag.id);
    const newTagNames = names.filter(
      (name) => !tags.some((tag) => name.toLowerCase() === tag.name.toLowerCase() || name.toLowerCase() === tag.slug.toLowerCase()),
    );

    return {
      action: normalizedAction,
      modelId: aiModel.id,
      output: { existingTagIds, newTagNames, names },
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
    user: `请从已有分类中为文章选择最合适的一个。已有分类：${categories.map((category) => `${category.name}(${category.slug})`).join("、") || "无"}。只输出 JSON：{"categorySlug":"slug","reason":"一句理由"}\n\n${baseContext}`,
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

function readOutputObject(output: unknown) {
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    throw new ValidationError("AI task output is invalid");
  }

  return output as Record<string, unknown>;
}

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
  }

  const tagIds = action === POST_AI_ACTIONS.tags ? toStringArray(output.existingTagIds) : null;

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
