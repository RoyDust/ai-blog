import type { Prisma } from "@prisma/client"

import { revalidatePublicContent } from "@/lib/cache"
import { ConflictError, NotFoundError, ValidationError, isPrismaConflictError } from "@/lib/api-errors"
import { prisma } from "@/lib/prisma"

export type CoverAssetInput = {
  url: string
  key?: string
  provider: string
  source: string
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
  status: string
  title: string | null
  alt: string | null
  description: string | null
  tags: string[]
  usageCount: number
  lastUsedAt: Date | null
  createdAt: Date
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
  source?: string
  status?: string
}) {
  const q = input.q?.trim()

  return {
    deletedAt: null,
    ...(input.source ? { source: input.source } : {}),
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

export async function listCoverAssets(input: {
  q?: string
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

export async function selectRandomCoverAsset(input: { random?: RandomSource } = {}) {
  const where = {
    status: ACTIVE_COVER_STATUS,
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

export async function backfillMissingPostCovers(input: {
  postIds?: string[]
  publishedOnly?: boolean
}) {
  const posts = await prisma.post.findMany({
    where: {
      deletedAt: null,
      ...(input.postIds && input.postIds.length > 0 ? { id: { in: input.postIds } } : {}),
      ...(input.publishedOnly === false ? {} : { published: true }),
      OR: [{ coverImage: null }, { coverImage: "" }],
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
