/**
 * AI 日报文章后处理。
 *
 * 职责：
 * - 在日报文章创建/更新后，复用后台文章 AI 动作补齐摘要、SEO、分类、标签与封面
 * - 保留日报标题与稳定 slug，不让通用标题/slug 建议破坏每日归档约定
 * - 单项失败不阻断日报运行，外层审核可继续给出发布判断
 */
import {
  POST_AI_ACTIONS,
  getPostForAiAction,
  runPostAiAction,
  type PostAiAction,
  type PostForAi,
} from "@/lib/ai-post-actions"
import { revalidatePublicContent } from "@/lib/cache"
import { touchCoverAssetUsage } from "@/lib/cover-assets"
import { getSummaryFieldsForExcerpt } from "@/lib/post-summary-status"
import { prisma } from "@/lib/prisma"

const AI_NEWS_POST_ACTIONS = [
  POST_AI_ACTIONS.summary,
  POST_AI_ACTIONS.seoDescription,
  POST_AI_ACTIONS.category,
  POST_AI_ACTIONS.tags,
  POST_AI_ACTIONS.coverImage,
] as const

const FALLBACK_CATEGORY_SLUGS = ["engineering", "product-experience", "backend", "frontend"] as const
const FALLBACK_TAG_SLUGS = ["engineering", "api-design", "observability"] as const

const POST_SELECT = {
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
} as const

export type AiNewsPostEnhancementApplied = {
  action: PostAiAction
  source: "ai" | "fallback"
}

export type AiNewsPostEnhancementFailure = {
  action: PostAiAction
  message: string
}

export type AiNewsPostEnhancementResult = {
  post: PostForAi | null
  applied: AiNewsPostEnhancementApplied[]
  skipped: PostAiAction[]
  failed: AiNewsPostEnhancementFailure[]
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(readString).filter(Boolean)
    : []
}

function readOutputObject(output: unknown) {
  return output && typeof output === "object" && !Array.isArray(output)
    ? output as Record<string, unknown>
    : {}
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "AI post enhancement failed"
}

function shouldSkipAction(action: PostAiAction, post: PostForAi) {
  if (action === POST_AI_ACTIONS.category) return Boolean(post.category)
  if (action === POST_AI_ACTIONS.tags) return post.tags.length > 0
  if (action === POST_AI_ACTIONS.coverImage) return Boolean(post.coverImage?.trim())
  return false
}

function orderedBySlugPreference<T extends { slug: string }>(items: T[], slugs: readonly string[]) {
  const bySlug = new Map(items.map((item) => [item.slug, item]))
  return slugs.map((slug) => bySlug.get(slug)).filter((item): item is T => Boolean(item))
}

async function findFallbackCategoryId() {
  const categories = await prisma.category.findMany({
    where: { slug: { in: [...FALLBACK_CATEGORY_SLUGS] }, deletedAt: null },
    select: { id: true, slug: true },
  })

  return orderedBySlugPreference(categories, FALLBACK_CATEGORY_SLUGS)[0]?.id ?? null
}

async function findFallbackTagIds() {
  const tags = await prisma.tag.findMany({
    where: { slug: { in: [...FALLBACK_TAG_SLUGS] }, deletedAt: null },
    select: { id: true, slug: true },
  })

  return orderedBySlugPreference(tags, FALLBACK_TAG_SLUGS).map((tag) => tag.id)
}

async function applyFallbackCategory(post: PostForAi) {
  const categoryId = await findFallbackCategoryId()

  if (!categoryId) {
    return null
  }

  return updatePostAndMaybeRevalidate(post.id, { categoryId })
}

async function updatePostAndMaybeRevalidate(postId: string, data: Parameters<typeof prisma.post.update>[0]["data"]) {
  const updated = await prisma.post.update({
    where: { id: postId },
    data,
    select: POST_SELECT,
  })

  if (updated.published) {
    revalidatePublicContent({
      slug: updated.slug,
      categorySlug: updated.category?.slug,
      tagSlugs: updated.tags.map((tag) => tag.slug),
    })
  }

  return updated
}

async function applySummaryAction({
  post,
  modelId,
}: {
  post: PostForAi
  modelId?: string | null
}) {
  const result = await runPostAiAction({ post, action: POST_AI_ACTIONS.summary, modelId })
  const output = readOutputObject(result.output)
  const summary = readString(output.summary)

  if (!summary) {
    throw new Error("AI summary output is invalid")
  }

  return updatePostAndMaybeRevalidate(post.id, {
    excerpt: summary,
    ...getSummaryFieldsForExcerpt(summary),
    summaryModelId: result.modelId ?? modelId ?? null,
  })
}

async function applySeoDescriptionAction({
  post,
  modelId,
}: {
  post: PostForAi
  modelId?: string | null
}) {
  const result = await runPostAiAction({ post, action: POST_AI_ACTIONS.seoDescription, modelId })
  const output = readOutputObject(result.output)
  const seoDescription = readString(output.seoDescription)

  if (!seoDescription) {
    throw new Error("AI SEO output is invalid")
  }

  return updatePostAndMaybeRevalidate(post.id, {
    seoDescription,
    seoGeneratedAt: new Date(),
    seoModelId: result.modelId ?? modelId ?? null,
  })
}

async function applyCategoryAction({
  post,
  modelId,
}: {
  post: PostForAi
  modelId?: string | null
}) {
  const result = await runPostAiAction({ post, action: POST_AI_ACTIONS.category, modelId })
  const output = readOutputObject(result.output)
  const categoryId = readString(output.categoryId)

  if (categoryId) {
    return {
      post: await updatePostAndMaybeRevalidate(post.id, { categoryId }),
      source: "ai" as const,
    }
  }

  const fallback = await applyFallbackCategory(post)
  if (!fallback) {
    throw new Error("AI category output did not match existing categories")
  }

  return { post: fallback, source: "fallback" as const }
}

async function applyFallbackTags(post: PostForAi) {
  const tagIds = await findFallbackTagIds()

  if (tagIds.length === 0) {
    return null
  }

  return updatePostAndMaybeRevalidate(post.id, {
    tags: { set: tagIds.map((id) => ({ id })) },
  })
}

async function applyTagsAction({
  post,
  modelId,
}: {
  post: PostForAi
  modelId?: string | null
}) {
  const result = await runPostAiAction({ post, action: POST_AI_ACTIONS.tags, modelId })
  const output = readOutputObject(result.output)
  const tagIds = readStringArray(output.existingTagIds)

  if (tagIds.length === 0) {
    const fallback = await applyFallbackTags(post)
    if (!fallback) {
      throw new Error("AI tag output did not match existing tags")
    }

    return { post: fallback, source: "fallback" as const }
  }

  return {
    post: await updatePostAndMaybeRevalidate(post.id, {
      tags: { set: tagIds.map((id) => ({ id })) },
    }),
    source: "ai" as const,
  }
}

async function applyCoverImageAction({
  post,
  modelId,
}: {
  post: PostForAi
  modelId?: string | null
}) {
  const result = await runPostAiAction({ post, action: POST_AI_ACTIONS.coverImage, modelId })
  const output = readOutputObject(result.output)
  const coverImage = readString(output.coverImage)
  const coverAssetId = readString(output.coverAssetId)

  if (!coverImage || !coverAssetId) {
    throw new Error("AI cover output is invalid")
  }

  const updated = await updatePostAndMaybeRevalidate(post.id, { coverImage, coverAssetId })
  await touchCoverAssetUsage(coverAssetId)

  return updated
}

function formatAction(action: PostAiAction) {
  if (action === POST_AI_ACTIONS.summary) return "摘要"
  if (action === POST_AI_ACTIONS.seoDescription) return "SEO 描述"
  if (action === POST_AI_ACTIONS.category) return "分类"
  if (action === POST_AI_ACTIONS.tags) return "标签"
  if (action === POST_AI_ACTIONS.coverImage) return "封面"
  return action
}

export function formatAiNewsPostEnhancementWarning(result: AiNewsPostEnhancementResult) {
  if (result.failed.length === 0) {
    return null
  }

  return `AI 辅助处理失败：${result.failed.map((failure) => `${formatAction(failure.action)}：${failure.message}`).join("；")}`
}

export async function applyAiNewsPostEnhancements({
  postId,
  modelId,
}: {
  postId: string
  modelId?: string | null
}): Promise<AiNewsPostEnhancementResult> {
  const result: AiNewsPostEnhancementResult = {
    post: null,
    applied: [],
    skipped: [],
    failed: [],
  }

  try {
    result.post = await getPostForAiAction(postId)
  } catch (error) {
    result.failed.push({ action: POST_AI_ACTIONS.summary, message: readErrorMessage(error) })
    return result
  }

  for (const action of AI_NEWS_POST_ACTIONS) {
    if (!result.post) {
      break
    }

    if (shouldSkipAction(action, result.post)) {
      result.skipped.push(action)
      continue
    }

    try {
      if (action === POST_AI_ACTIONS.summary) {
        result.post = await applySummaryAction({ post: result.post, modelId })
        result.applied.push({ action, source: "ai" })
      } else if (action === POST_AI_ACTIONS.seoDescription) {
        result.post = await applySeoDescriptionAction({ post: result.post, modelId })
        result.applied.push({ action, source: "ai" })
      } else if (action === POST_AI_ACTIONS.category) {
        const applied = await applyCategoryAction({ post: result.post, modelId })
        result.post = applied.post
        result.applied.push({ action, source: applied.source })
      } else if (action === POST_AI_ACTIONS.tags) {
        const applied = await applyTagsAction({ post: result.post, modelId })
        result.post = applied.post
        result.applied.push({ action, source: applied.source })
      } else if (action === POST_AI_ACTIONS.coverImage) {
        result.post = await applyCoverImageAction({ post: result.post, modelId })
        result.applied.push({ action, source: "ai" })
      }
    } catch (error) {
      let message = readErrorMessage(error)

      if (action === POST_AI_ACTIONS.category && result.post) {
        try {
          const fallback = await applyFallbackCategory(result.post)
          if (fallback) {
            result.post = fallback
            result.applied.push({ action, source: "fallback" })
          }
        } catch (fallbackError) {
          message = `${message}; fallback category failed: ${readErrorMessage(fallbackError)}`
        }
      } else if (action === POST_AI_ACTIONS.tags && result.post) {
        try {
          const fallback = await applyFallbackTags(result.post)
          if (fallback) {
            result.post = fallback
            result.applied.push({ action, source: "fallback" })
          }
        } catch (fallbackError) {
          message = `${message}; fallback tags failed: ${readErrorMessage(fallbackError)}`
        }
      }

      result.failed.push({ action, message })
    }
  }

  return result
}
