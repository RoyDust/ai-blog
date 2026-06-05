/**
 * AI 草稿与后台文章写入流程。
 *
 * 职责：
 * - 管理 AI 客户端草稿与正式文章之间的绑定关系
 * - 把 AI 生成内容安全地落为未发布草稿
 * - 提供后台创建 / 更新 / 发布文章时可复用的写库逻辑
 * - 在必要时刷新前台缓存并维护封面素材使用状态
 *
 * 阅读建议：
 * - AI 客户端草稿链路先看 upsertAiDraft / getAiDraft / publishAiDraftPost
 * - 后台管理链路再看 createAdminPost / updateAdminPost
 */
import { prisma } from "@/lib/prisma"
import { calculateReadingTimeMinutes } from "@/lib/reading-time"
import { revalidatePublicContent } from "@/lib/cache"
import { resolvePostCoverInput, touchCoverAssetUsage } from "@/lib/cover-assets"
import { ConflictError, NotFoundError, ValidationError, isPrismaConflictError } from "@/lib/api-errors"
import type { AiClientSession } from "@/lib/ai-auth"
import { getOptionalSummaryFieldsForExcerpt, getSummaryFieldsForExcerpt } from "@/lib/post-summary-status"

export type AiDraftInput = {
  externalId: string
  title: string
  slug: string
  content: string
  excerpt?: string
  coverImage?: string
  categorySlug?: string
  tagSlugs?: string[]
}

export type AiDraftRecord = {
  externalId: string
  postId: string
  title: string
  slug: string
  content: string
  excerpt: string | null
  coverImage: string | null
  readingTimeMinutes: number
  categorySlug: string | null
  tagSlugs: string[]
}

type AdminPostInput = {
  title: string
  content: string
  slug: string
  excerpt?: string
  coverImage?: string
  coverAssetId?: string | null
  categoryId?: string | null
  tagIds?: string[] | null
  seriesId?: string | null
  seriesOrder?: number
  scheduledAt?: Date | null
  published: boolean
  featured?: boolean
  generatedByAiNews?: boolean
}

type AdminPostPatchInput = {
  title: string
  content: string
  slug?: string
  excerpt?: string
  seoDescription?: string | null
  coverImage?: string
  coverAssetId?: string | null
  categoryId?: string | null
  tagIds?: string[] | null
  seriesId?: string | null
  seriesOrder?: number
  scheduledAt?: Date | null
  published?: boolean
  featured?: boolean
  generatedByAiNews?: boolean
}

type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

const draftSelect = {
  id: true,
  title: true,
  slug: true,
  content: true,
  excerpt: true,
  coverImage: true,
  readingTimeMinutes: true,
  category: { select: { slug: true, deletedAt: true } },
  tags: { select: { slug: true, deletedAt: true } },
} as const

/**
 * Maps a Prisma post row back to the stable AI draft response contract.
 */
function buildAiDraftRecord(externalId: string, post: {
  id: string
  title: string
  slug: string
  content: string
  excerpt: string | null
  coverImage: string | null
  readingTimeMinutes: number
  category: { slug: string; deletedAt?: Date | null } | null
  tags: Array<{ slug: string; deletedAt?: Date | null }>
}): AiDraftRecord {
  return {
    externalId,
    postId: post.id,
    title: post.title,
    slug: post.slug,
    content: post.content,
    excerpt: post.excerpt,
    coverImage: post.coverImage,
    readingTimeMinutes: post.readingTimeMinutes,
    categorySlug: post.category && !post.category.deletedAt ? post.category.slug : null,
    tagSlugs: post.tags
      .filter((tag: { deletedAt?: Date | null }) => !tag.deletedAt)
      .map((tag: { slug: string }) => tag.slug),
  }
}

type DraftBindingPost = {
  id: string
  deletedAt: Date | null
  published: boolean
  slug: string
  category: { slug: string; deletedAt?: Date | null } | null
  tags: Array<{ slug: string; deletedAt?: Date | null }>
}

type DraftBindingRecord = {
  postId: string
  post: DraftBindingPost | null
}

type DraftWriteGuardPost = {
  id: string
  deletedAt: Date | null
  published: boolean
}

function assertDraftBindingIsUnpublished(binding: DraftBindingRecord | null) {
  if (binding?.post && !binding.post.deletedAt && binding.post.published) {
    throw new ConflictError("Draft binding points to a published post")
  }
}

function isPrismaRecordNotFoundError(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2025"
}

/**
 * Converts low-level Prisma update misses into the draft-specific guard error.
 */
function throwDraftWriteGuardError(post: DraftWriteGuardPost | null): never {
  if (post && !post.deletedAt && post.published) {
    throw new ConflictError("Draft binding points to a published post")
  }

  throw new NotFoundError("Draft not found")
}

/**
 * Resolves user-facing taxonomy slugs into ids before draft or post writes.
 * Missing slugs fail fast so AI clients cannot create dangling taxonomy references.
 */
async function resolveAiTaxonomy(input: AiDraftInput) {
  const categorySlug = input.categorySlug?.trim()
  let category: { id: string; slug: string } | null = null

  if (categorySlug) {
    category = await prisma.category.findFirst({
      where: { slug: categorySlug, deletedAt: null },
      select: { id: true, slug: true },
    })

    if (!category) {
      throw new ValidationError("Invalid categorySlug")
    }
  }

  const tagSlugs = (input.tagSlugs ?? []).map((slug) => slug.trim()).filter(Boolean)
  const uniqueTagSlugs = [...new Set(tagSlugs)]
  let tags: Array<{ id: string; slug: string }> = []

  if (uniqueTagSlugs.length > 0) {
    tags = await prisma.tag.findMany({
      where: { slug: { in: uniqueTagSlugs }, deletedAt: null },
      select: { id: true, slug: true },
    })

    if (tags.length !== uniqueTagSlugs.length) {
      throw new ValidationError("Invalid tagSlugs")
    }
  }

  return { category, tags }
}

/**
 * Creates a new unpublished post and binds it to an AI external id in one transaction.
 */
async function createDraftWithBinding({
  clientId,
  externalId,
  authorId,
  input,
  categoryId,
  tagConnections,
  replaceBinding,
  readingTimeMinutes,
}: {
  clientId: string
  externalId: string
  authorId: string
  input: AiDraftInput
  categoryId?: string
  tagConnections: Array<{ id: string }>
  replaceBinding: boolean
  readingTimeMinutes: number
}) {
  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    const post = await tx.post.create({
      data: {
        title: input.title,
        slug: input.slug,
        content: input.content,
        excerpt: input.excerpt,
        ...getSummaryFieldsForExcerpt(input.excerpt),
        coverImage: input.coverImage,
        readingTimeMinutes,
        published: false,
        publishedAt: null,
        authorId,
        categoryId,
        tags: tagConnections.length > 0 ? { connect: tagConnections } : undefined,
      },
      select: draftSelect,
    })

    if (replaceBinding) {
      await tx.aiDraftBinding.update({
        where: {
          clientId_externalId: {
            clientId,
            externalId,
          },
        },
        data: { postId: post.id },
      })
    } else {
      await tx.aiDraftBinding.create({
        data: {
          clientId,
          externalId,
          postId: post.id,
        },
      })
    }

    return post
  })
}

/**
 * Updates the unpublished post behind an existing AI draft binding.
 * If the post was deleted or published meanwhile, the write guard reports the safer domain error.
 */
async function updateDraftPost({
  binding,
  input,
  categoryId,
  tagConnections,
  readingTimeMinutes,
}: {
  binding: DraftBindingRecord
  input: AiDraftInput
  categoryId?: string
  tagConnections: Array<{ id: string }>
  readingTimeMinutes: number
}) {
  return prisma.$transaction(async (tx: PrismaTransactionClient) => {
    try {
      return await tx.post.update({
        where: {
          id: binding.postId,
          deletedAt: null,
          published: false,
        },
        data: {
          title: input.title,
          slug: input.slug,
          content: input.content,
          excerpt: input.excerpt,
          ...getOptionalSummaryFieldsForExcerpt(input.excerpt),
          coverImage: input.coverImage,
          readingTimeMinutes,
          published: false,
          publishedAt: null,
          categoryId,
          tags: { set: tagConnections },
        },
        select: draftSelect,
      })
    } catch (error) {
      if (!isPrismaRecordNotFoundError(error)) {
        throw error
      }

      const currentPost = await tx.post.findUnique({
        where: { id: binding.postId },
        select: {
          id: true,
          deletedAt: true,
          published: true,
        },
      })

      throwDraftWriteGuardError(currentPost)
    }
  })
}

/**
 * 按 externalId 幂等写入 AI 草稿。
 *
 * 行为：
 * - 首次写入时创建未发布文章并建立 binding
 * - 已存在未发布 binding 时更新原草稿
 * - 若 binding 指向已发布文章，则拒绝覆盖，防止 AI 草稿污染正式内容
 */
export async function upsertAiDraft({
  client,
  input,
}: {
  client: AiClientSession
  input: AiDraftInput
}) {
  const { category, tags } = await resolveAiTaxonomy(input)
  const binding = await prisma.aiDraftBinding.findUnique({
    where: {
      clientId_externalId: {
        clientId: client.id,
        externalId: input.externalId,
      },
    },
    select: {
      postId: true,
      post: {
        select: {
          id: true,
          deletedAt: true,
          published: true,
          slug: true,
          category: { select: { slug: true } },
          tags: { where: { deletedAt: null }, select: { slug: true } },
        },
      },
    },
  })

  const readingTimeMinutes = calculateReadingTimeMinutes(input.content)
  const tagConnections = tags.map((tag: { id: string }) => ({ id: tag.id }))
  assertDraftBindingIsUnpublished(binding)
  const isDeletedBinding = Boolean(binding?.post?.deletedAt)

  if (!binding || isDeletedBinding) {
    try {
      const post = await createDraftWithBinding({
        clientId: client.id,
        externalId: input.externalId,
        authorId: client.ownerId,
        input,
        categoryId: category?.id,
        tagConnections,
        replaceBinding: Boolean(binding),
        readingTimeMinutes,
      })

      return {
        operation: "created",
        draft: buildAiDraftRecord(input.externalId, post),
      }
    } catch (error) {
      if (isPrismaConflictError(error)) {
        const existing = await prisma.aiDraftBinding.findUnique({
          where: {
            clientId_externalId: {
              clientId: client.id,
              externalId: input.externalId,
            },
          },
          select: {
            postId: true,
            post: {
              select: {
                id: true,
                deletedAt: true,
                published: true,
                slug: true,
                category: { select: { slug: true } },
                tags: { where: { deletedAt: null }, select: { slug: true } },
              },
            },
          },
        })

        if (existing?.post && !existing.post.deletedAt) {
          assertDraftBindingIsUnpublished(existing)

          const post = await updateDraftPost({
            binding: existing,
            input,
            categoryId: category?.id,
            tagConnections,
            readingTimeMinutes,
          })

          return {
            operation: "updated",
            draft: buildAiDraftRecord(input.externalId, post),
          }
        }
      }

      throw error
    }
  }

  const post = await updateDraftPost({
    binding,
    input,
    categoryId: category?.id,
    tagConnections,
    readingTimeMinutes,
  })

  return {
    operation: "updated",
    draft: buildAiDraftRecord(input.externalId, post),
  }
}

/**
 * 读取某个 AI 客户端在指定 externalId 下的未发布草稿。
 * 只返回仍然有效、未删除、未发布的绑定记录。
 */
export async function getAiDraft({
  client,
  externalId,
}: {
  client: AiClientSession
  externalId: string
}) {
  const binding = await prisma.aiDraftBinding.findFirst({
    where: {
      clientId: client.id,
      externalId,
      post: {
        deletedAt: null,
        published: false,
      },
    },
    select: {
      externalId: true,
      post: {
        select: {
          ...draftSelect,
          published: true,
        },
      },
    },
  })

  if (!binding?.post || binding.post.published) {
    return null
  }

  return buildAiDraftRecord(binding.externalId, binding.post)
}

/**
 * 将 AI 草稿提升为正式发布文章，并刷新受影响的前台列表页/详情页缓存。
 */
export async function publishAiDraftPost({ postId }: { postId: string }) {
  const published = await prisma.post.update({
    where: {
      id: postId,
      deletedAt: null,
      published: false,
    },
    data: {
      published: true,
      publishedAt: new Date(),
    },
    select: {
      id: true,
      slug: true,
      published: true,
      category: { select: { slug: true } },
      series: { select: { slug: true } },
      tags: { where: { deletedAt: null }, select: { slug: true } },
    },
  })

  revalidatePublicContent({
    slug: published.slug,
    categorySlug: published.category?.slug,
    seriesSlug: published.series?.slug,
    tagSlugs: published.tags.map((tag: { slug: string }) => tag.slug),
  })

  return published
}

/**
 * 后台手动创建文章。
 *
 * 额外处理：
 * - 计算阅读时长
 * - 解析封面输入或自动分配封面
 * - 已发布文章会立即触发前台缓存失效
 */
export async function createAdminPost({
  authorId,
  input,
}: {
  authorId: string
  input: AdminPostInput
}) {
  const readingTimeMinutes = calculateReadingTimeMinutes(input.content)
  const cover = await resolvePostCoverInput({
    coverImage: input.coverImage,
    coverAssetId: input.coverAssetId,
    allowRandom: input.published && !input.scheduledAt && !input.coverImage?.trim(),
  })
  const published = input.scheduledAt ? false : input.published
  const post = await prisma.post.create({
    data: {
      title: input.title,
      content: input.content,
      slug: input.slug,
      excerpt: input.excerpt,
      ...getSummaryFieldsForExcerpt(input.excerpt),
      coverImage: cover.coverImage,
      coverAssetId: cover.coverAssetId,
      categoryId: input.categoryId,
      seriesId: input.seriesId,
      seriesOrder: input.seriesOrder ?? 0,
      published,
      generatedByAiNews: input.generatedByAiNews ?? false,
      featured: input.featured ?? false,
      publishedAt: published ? new Date() : null,
      scheduledAt: input.scheduledAt ?? null,
      readingTimeMinutes,
      authorId,
      tags: input.tagIds ? { connect: input.tagIds.map((id) => ({ id })) } : undefined,
    },
    include: {
      author: { select: { id: true, name: true, image: true } },
      category: true,
      series: { select: { slug: true } },
      tags: true,
    },
  })

  await touchCoverAssetUsage(cover.selectedAssetId)

  if (post.published) {
    revalidatePublicContent({
      slug: post.slug,
      categorySlug: post.category?.slug,
      seriesSlug: post.series?.slug,
      tagSlugs: post.tags.map((tag: { slug: string }) => tag.slug),
    })
  }

  return post
}

/**
 * 后台更新文章。
 *
 * 说明：
 * - 统一处理封面、摘要、SEO、标签、分类与发布状态变更
 * - 当发布状态或路径相关字段变化时，会同步刷新前台缓存
 */
export async function updateAdminPost({
  id,
  input,
}: {
  id: string
  input: AdminPostPatchInput
}) {
  const readingTimeMinutes = calculateReadingTimeMinutes(input.content)
  const existing = await prisma.post.findFirst({
    where: { id, deletedAt: null },
    select: {
      slug: true,
      coverImage: true,
      published: true,
      publishedAt: true,
      category: { select: { slug: true } },
      series: { select: { slug: true } },
      tags: { where: { deletedAt: null }, select: { slug: true } },
      scheduledAt: true,
    },
  })

  if (!existing) {
    throw new NotFoundError("Post not found")
  }

  const shouldAutoAssignCover = input.published === true && !input.scheduledAt && !input.coverImage?.trim() && !existing.coverImage?.trim()
  const cover =
    input.coverAssetId !== undefined || input.coverImage !== undefined || shouldAutoAssignCover
      ? await resolvePostCoverInput({
          coverImage: input.coverImage,
          coverAssetId: input.coverAssetId,
          allowRandom: shouldAutoAssignCover,
        })
      : null
  const nextPublished = input.scheduledAt ? false : input.published
  const nextPublishedAt = input.scheduledAt
    ? null
    : input.published === undefined
      ? undefined
      : input.published
        ? existing.published
          ? undefined
          : new Date()
        : null

  const updated = await prisma.post.update({
    where: { id },
    data: {
      title: input.title,
      slug: input.slug,
      content: input.content,
      excerpt: input.excerpt,
      ...getOptionalSummaryFieldsForExcerpt(input.excerpt),
      seoDescription: input.seoDescription,
      seoGeneratedAt: input.seoDescription ? new Date() : input.seoDescription === null ? null : undefined,
      seoModelId: input.seoDescription === null ? null : undefined,
      coverImage: cover ? cover.coverImage : undefined,
      coverAssetId: cover ? cover.coverAssetId : undefined,
      readingTimeMinutes,
      categoryId: input.categoryId,
      seriesId: input.seriesId,
      seriesOrder: input.seriesOrder,
      published: nextPublished,
      generatedByAiNews: input.generatedByAiNews,
      publishedAt: nextPublishedAt,
      scheduledAt: input.scheduledAt,
      tags: input.tagIds
        ? {
            set: input.tagIds.map((tagId: string) => ({ id: tagId })),
          }
        : undefined,
      featured: input.featured,
    },
    select: {
      id: true,
      slug: true,
      published: true,
      featured: true,
      readingTimeMinutes: true,
      category: { select: { slug: true } },
      seriesId: true,
      seriesOrder: true,
      series: { select: { slug: true } },
      tags: { where: { deletedAt: null }, select: { slug: true } },
    },
  })

  await touchCoverAssetUsage(cover?.selectedAssetId)

  revalidatePublicContent({
    slug: updated.published ? updated.slug : null,
    previousSlug: existing.slug,
    categorySlug: updated.published ? updated.category?.slug : null,
    previousCategorySlug: existing.category?.slug,
    seriesSlug: updated.published ? updated.series?.slug : null,
    previousSeriesSlug: existing.series?.slug,
    tagSlugs: updated.published ? updated.tags.map((tag: { slug: string }) => tag.slug) : [],
    previousTagSlugs: existing.tags.map((tag: { slug: string }) => tag.slug),
  })

  return updated
}
