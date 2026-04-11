import { prisma } from "@/lib/prisma"
import { calculateReadingTimeMinutes } from "@/lib/reading-time"
import { revalidatePublicContent } from "@/lib/cache"
import { NotFoundError, ValidationError } from "@/lib/api-errors"
import type { AiClientSession } from "@/lib/ai-auth"

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
  categoryId?: string | null
  tagIds?: string[] | null
  published: boolean
}

type AdminPostPatchInput = {
  title: string
  content: string
  slug?: string
  excerpt?: string
  coverImage?: string
  categoryId?: string | null
  tagIds?: string[] | null
  published?: boolean
}

const draftSelect = {
  id: true,
  title: true,
  slug: true,
  content: true,
  excerpt: true,
  coverImage: true,
  readingTimeMinutes: true,
  category: { select: { slug: true } },
  tags: { select: { slug: true } },
} as const

function buildAiDraftRecord(externalId: string, post: {
  id: string
  title: string
  slug: string
  content: string
  excerpt: string | null
  coverImage: string | null
  readingTimeMinutes: number
  category: { slug: string } | null
  tags: Array<{ slug: string }>
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
    categorySlug: post.category?.slug ?? null,
    tagSlugs: post.tags.map((tag) => tag.slug),
  }
}

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
    select: { postId: true },
  })

  const readingTimeMinutes = calculateReadingTimeMinutes(input.content)
  const tagConnections = tags.map((tag) => ({ id: tag.id }))

  if (!binding) {
    const post = await prisma.post.create({
      data: {
        title: input.title,
        slug: input.slug,
        content: input.content,
        excerpt: input.excerpt,
        coverImage: input.coverImage,
        readingTimeMinutes,
        published: false,
        publishedAt: null,
        authorId: client.ownerId,
        categoryId: category?.id,
        tags: tagConnections.length > 0 ? { connect: tagConnections } : undefined,
      },
      select: draftSelect,
    })

    await prisma.aiDraftBinding.create({
      data: {
        clientId: client.id,
        externalId: input.externalId,
        postId: post.id,
      },
    })

    return {
      operation: "created",
      draft: buildAiDraftRecord(input.externalId, post),
    }
  }

  const post = await prisma.post.update({
    where: { id: binding.postId },
    data: {
      title: input.title,
      slug: input.slug,
      content: input.content,
      excerpt: input.excerpt,
      coverImage: input.coverImage,
      readingTimeMinutes,
      published: false,
      publishedAt: null,
      categoryId: category?.id,
      tags: { set: tagConnections },
    },
    select: draftSelect,
  })

  return {
    operation: "updated",
    draft: buildAiDraftRecord(input.externalId, post),
  }
}

export async function getAiDraft({
  client,
  externalId,
}: {
  client: AiClientSession
  externalId: string
}) {
  const binding = await prisma.aiDraftBinding.findUnique({
    where: {
      clientId_externalId: {
        clientId: client.id,
        externalId,
      },
    },
    select: {
      externalId: true,
      post: {
        select: draftSelect,
      },
    },
  })

  if (!binding?.post) {
    return null
  }

  return buildAiDraftRecord(binding.externalId, binding.post)
}

export async function createAdminPost({
  authorId,
  input,
}: {
  authorId: string
  input: AdminPostInput
}) {
  const readingTimeMinutes = calculateReadingTimeMinutes(input.content)
  const post = await prisma.post.create({
    data: {
      title: input.title,
      content: input.content,
      slug: input.slug,
      excerpt: input.excerpt,
      coverImage: input.coverImage,
      categoryId: input.categoryId,
      published: input.published,
      publishedAt: input.published ? new Date() : null,
      readingTimeMinutes,
      authorId,
      tags: input.tagIds ? { connect: input.tagIds.map((id) => ({ id })) } : undefined,
    },
    include: {
      author: { select: { id: true, name: true, image: true } },
      category: true,
      tags: true,
    },
  })

  if (post.published) {
    revalidatePublicContent({
      slug: post.slug,
      categorySlug: post.category?.slug,
      tagSlugs: post.tags.map((tag) => tag.slug),
    })
  }

  return post
}

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
      category: { select: { slug: true } },
      tags: { where: { deletedAt: null }, select: { slug: true } },
    },
  })

  if (!existing) {
    throw new NotFoundError("Post not found")
  }

  const updated = await prisma.post.update({
    where: { id },
    data: {
      title: input.title,
      slug: input.slug,
      content: input.content,
      excerpt: input.excerpt,
      coverImage: input.coverImage,
      readingTimeMinutes,
      categoryId: input.categoryId,
      tags: input.tagIds
        ? {
            set: input.tagIds.map((tagId: string) => ({ id: tagId })),
          }
        : undefined,
      published: input.published,
      publishedAt: input.published ? new Date() : null,
    },
    select: {
      id: true,
      slug: true,
      published: true,
      readingTimeMinutes: true,
      category: { select: { slug: true } },
      tags: { where: { deletedAt: null }, select: { slug: true } },
    },
  })

  revalidatePublicContent({
    slug: updated.published ? updated.slug : null,
    previousSlug: existing.slug,
    categorySlug: updated.published ? updated.category?.slug : null,
    previousCategorySlug: existing.category?.slug,
    tagSlugs: updated.published ? updated.tags.map((tag) => tag.slug) : [],
    previousTagSlugs: existing.tags.map((tag) => tag.slug),
  })

  return updated
}
