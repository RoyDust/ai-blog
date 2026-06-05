/**
 * 封面素材仓库与文章封面解析逻辑。
 *
 * 职责：
 * - 管理封面素材的创建、更新、软删除与随机挑选
 * - 统一校验七牛封面地址与 key 规则
 * - 在文章写入时解析“手填 URL / 指定素材 / 随机素材”三种封面来源
 * - 维护封面素材的使用次数与前台缓存刷新
 */
import type { Prisma } from "@prisma/client"

import { revalidatePublicContent } from "@/lib/cache"
import { ConflictError, NotFoundError, ValidationError, isPrismaConflictError } from "@/lib/api-errors"
import { prisma } from "@/lib/prisma"

export type CoverAssetInput = {
  url: string
  key?: string
  provider: string
  source: string
  generatedByAi?: boolean
  status: string
  title?: string
  alt?: string
  description?: string
  tags: string[]
  width?: number
  height?: number
  blurDataUrl?: string
  aiPrompt?: string
  aiModelId?: string
  metadata?: Prisma.InputJsonValue
  createdById?: string
}

export type CoverAssetPatchInput = {
  title?: string | null
  alt?: string | null
  description?: string | null
  tags?: string[]
  status?: string
}

export type CoverAssetRecord = {
  id: string
  url: string
  key: string | null
  provider: string
  source: string
  generatedByAi: boolean
  status: string
  title: string | null
  alt: string | null
  description: string | null
  tags: string[]
  usageCount: number
  lastUsedAt: Date | null
  createdAt: Date
  aiModelId?: string | null
}

type RandomSource = () => number

type PostForRevalidation = {
  id: string
  slug: string
  published: boolean
  category: { slug: string } | null
  tags: Array<{ slug: string }>
}

const ACTIVE_COVER_STATUS = "active"

function normalizeUrlHost(value: string) {
  return new URL(value).hostname.toLowerCase()
}

function getQiniuDomainHost() {
  const domain = process.env.QINIU_DOMAIN
  if (!domain) {
    return null
  }

  try {
    return normalizeUrlHost(domain)
  } catch {
    return null
  }
}

function normalizeProvider(value: string) {
  return value.trim().toLowerCase()
}

function assertQiniuCoverAsset(input: Pick<CoverAssetInput, "url" | "key" | "provider">) {
  if (normalizeProvider(input.provider) !== "qiniu") {
    return
  }

  const expectedHost = getQiniuDomainHost()
  if (expectedHost && normalizeUrlHost(input.url) !== expectedHost) {
    throw new ValidationError("Cover URL does not match Qiniu domain")
  }

  if (input.key && !input.key.startsWith("covers/")) {
    throw new ValidationError("Invalid Qiniu cover key")
  }
}

function buildListWhere(input: {
  q?: string
  generatedByAi?: boolean
  source?: string
  status?: string
}) {
  const q = input.q?.trim()

  return {
    deletedAt: null,
    ...(input.source ? { source: input.source } : {}),
    ...(typeof input.generatedByAi === "boolean" ? { generatedByAi: input.generatedByAi } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(q
      ? {
          OR: [
            { url: { contains: q, mode: "insensitive" as const } },
            { title: { contains: q, mode: "insensitive" as const } },
            { alt: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
            { tags: { has: q } },
          ],
        }
      : {}),
  }
}

/**
 * 分页查询封面素材库。
 * 支持关键字、来源、状态过滤，供后台素材管理页复用。
 */
export async function listCoverAssets(input: {
  q?: string
  generatedByAi?: boolean
  source?: string
  status?: string
  page?: number
  limit?: number
}) {
  const page = Math.max(1, input.page ?? 1)
  const limit = Math.min(60, Math.max(1, input.limit ?? 24))
  const where = buildListWhere(input)
  const [items, total] = await Promise.all([
    prisma.coverAsset.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.coverAsset.count({ where }),
  ])

  return {
    items,
    total,
    page,
    limit,
  }
}

/**
 * 创建封面素材。
 * 若 URL 已存在，则优先复用现有记录；若记录已软删除，则恢复并覆盖为最新元数据。
 */
export async function createCoverAsset(input: CoverAssetInput) {
  assertQiniuCoverAsset(input)

  const existing = await prisma.coverAsset.findUnique({ where: { url: input.url } })
  if (existing) {
    if (existing.deletedAt) {
      return prisma.coverAsset.update({
        where: { id: existing.id },
        data: {
          key: input.key,
          provider: input.provider,
          source: input.source,
          generatedByAi: input.generatedByAi ?? input.source === "ai",
          status: input.status,
          title: input.title,
          alt: input.alt,
          description: input.description,
          tags: input.tags,
          width: input.width,
          height: input.height,
          blurDataUrl: input.blurDataUrl,
          aiPrompt: input.aiPrompt,
          aiModelId: input.aiModelId,
          metadata: input.metadata,
          createdById: input.createdById,
          deletedAt: null,
        },
      })
    }

    return existing
  }

  try {
    return await prisma.coverAsset.create({
      data: {
        url: input.url,
        key: input.key,
        provider: input.provider,
        source: input.source,
        generatedByAi: input.generatedByAi ?? input.source === "ai",
        status: input.status,
        title: input.title,
        alt: input.alt,
        description: input.description,
        tags: input.tags,
        width: input.width,
        height: input.height,
        blurDataUrl: input.blurDataUrl,
        aiPrompt: input.aiPrompt,
        aiModelId: input.aiModelId,
        metadata: input.metadata,
        createdById: input.createdById,
      },
    })
  } catch (error) {
    if (!isPrismaConflictError(error)) {
      throw error
    }

    const duplicate = await prisma.coverAsset.findUnique({ where: { url: input.url } })
    if (duplicate) {
      return duplicate
    }

    throw new ConflictError("Cover asset already exists")
  }
}

/**
 * 更新封面素材的展示元数据。
 */
export async function updateCoverAsset(id: string, input: CoverAssetPatchInput) {
  const existing = await prisma.coverAsset.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  })

  if (!existing) {
    throw new NotFoundError("Cover asset not found")
  }

  return prisma.coverAsset.update({
    where: { id },
    data: {
      title: input.title,
      alt: input.alt,
      description: input.description,
      tags: input.tags,
      status: input.status,
    },
  })
}

/**
 * 软删除封面素材。
 * 通过 archived + deletedAt 标记，而不是直接物理删除。
 */
export async function softDeleteCoverAsset(id: string) {
  const existing = await prisma.coverAsset.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  })

  if (!existing) {
    throw new NotFoundError("Cover asset not found")
  }

  return prisma.coverAsset.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      status: "archived",
    },
  })
}

/**
 * 从活跃封面素材中随机选择一张。
 * 主要用于文章发布时的自动补封面策略。
 */
export async function selectRandomCoverAsset(input: { random?: RandomSource } = {}) {
  const where = {
    status: ACTIVE_COVER_STATUS,
    source: "upload",
    generatedByAi: false,
    deletedAt: null,
  }
  const count = await prisma.coverAsset.count({ where })

  if (count === 0) {
    return null
  }

  const random = input.random ?? Math.random
  const skip = Math.min(count - 1, Math.floor(Math.max(0, Math.min(0.999999, random())) * count))

  return prisma.coverAsset.findFirst({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip,
  })
}

/**
 * 读取一条仍可用于文章的活跃封面素材。
 */
export async function getActiveCoverAsset(id: string) {
  const asset = await prisma.coverAsset.findFirst({
    where: {
      id,
      status: ACTIVE_COVER_STATUS,
      deletedAt: null,
    },
  })

  if (!asset) {
    throw new ValidationError("Invalid coverAssetId")
  }

  return asset
}

/**
 * 解析文章封面输入。
 * 优先级：指定素材 > 手填 URL > 随机活跃素材 > 保持空值。
 */
export async function resolvePostCoverInput(input: {
  coverImage?: string | null
  coverAssetId?: string | null
  allowRandom?: boolean
}) {
  if (input.coverAssetId) {
    const asset = await getActiveCoverAsset(input.coverAssetId)
    return {
      coverImage: asset.url,
      coverAssetId: asset.id,
      selectedAssetId: asset.id,
    }
  }

  const manualUrl = input.coverImage?.trim()
  if (manualUrl) {
    return {
      coverImage: manualUrl,
      coverAssetId: null,
      selectedAssetId: null,
    }
  }

  if (input.allowRandom) {
    const asset = await selectRandomCoverAsset()
    if (asset) {
      return {
        coverImage: asset.url,
        coverAssetId: asset.id,
        selectedAssetId: asset.id,
      }
    }
  }

  return {
    coverImage: undefined,
    coverAssetId: input.coverAssetId === null ? null : undefined,
    selectedAssetId: null,
  }
}

/**
 * 更新封面素材使用统计。
 * 当文章实际采用某条素材时调用，用于后台素材热度管理。
 */
export async function touchCoverAssetUsage(coverAssetId: string | null | undefined) {
  if (!coverAssetId) {
    return
  }

  await prisma.coverAsset.update({
    where: { id: coverAssetId },
    data: {
      usageCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  })
}

function revalidatePost(post: PostForRevalidation) {
  if (!post.published) {
    return
  }

  revalidatePublicContent({
    slug: post.slug,
    categorySlug: post.category?.slug,
    tagSlugs: post.tags.map((tag) => tag.slug),
  })
}

/**
 * 把一条封面素材正式应用到文章。
 * 会在事务里同时更新文章封面字段与素材使用统计，并在必要时刷新前台缓存。
 */
export async function applyCoverAssetToPost(postId: string, coverAsset: CoverAssetRecord) {
  const updated = await prisma.$transaction(async (tx) => {
    const post = await tx.post.update({
      where: { id: postId },
      data: {
        coverImage: coverAsset.url,
        coverAssetId: coverAsset.id,
      },
      select: {
        id: true,
        slug: true,
        published: true,
        category: { select: { slug: true } },
        tags: { where: { deletedAt: null }, select: { slug: true } },
      },
    })

    await tx.coverAsset.update({
      where: { id: coverAsset.id },
      data: {
        usageCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
    })

    return post
  })

  revalidatePost(updated)
  return updated
}

/**
 * 为缺少封面的文章从素材库补一张随机封面。
 * 如果文章已有封面，或当前素材库为空，则返回 null。
 */
export async function ensurePostCoverFromLibrary(post: { id: string; coverImage?: string | null }) {
  if (post.coverImage?.trim()) {
    return null
  }

  const asset = await selectRandomCoverAsset()
  if (!asset) {
    return null
  }

  return applyCoverAssetToPost(post.id, asset)
}

/**
 * 批量为文章分配上传封面素材。
 * 默认只补齐缺少封面的非 AI 日报文章；replaceExisting=true 时会显式覆盖已有封面。
 */
export async function backfillMissingPostCovers(input: {
  postIds?: string[]
  publishedOnly?: boolean
  replaceExisting?: boolean
  nonAiDailyOnly?: boolean
}) {
  const posts = await prisma.post.findMany({
    where: {
      deletedAt: null,
      ...(input.postIds && input.postIds.length > 0 ? { id: { in: input.postIds } } : {}),
      ...(input.publishedOnly === false ? {} : { published: true }),
      ...(input.nonAiDailyOnly === false ? {} : { generatedByAiNews: false }),
      ...(input.replaceExisting ? {} : { OR: [{ coverImage: null }, { coverImage: "" }] }),
    },
    select: { id: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  })

  if (posts.length === 0) {
    return { updated: 0, skipped: 0 }
  }

  let updated = 0
  const skipped = 0

  for (const post of posts) {
    const asset = await selectRandomCoverAsset()
    if (!asset) {
      return {
        updated,
        skipped: posts.length - updated,
        skippedReason: "NO_ACTIVE_COVERS" as const,
      }
    }

    await applyCoverAssetToPost(post.id, asset)
    updated += 1
  }

  return { updated, skipped }
}
