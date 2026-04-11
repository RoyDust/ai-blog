import { prisma } from "@/lib/prisma"
import { calculateReadingTimeMinutes } from "@/lib/reading-time"
import { revalidatePublicContent } from "@/lib/cache"
import { ConflictError, NotFoundError, ValidationError, isPrismaConflictError } from "@/lib/api-errors"
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

type DraftBindingPost = {
  id: string
  deletedAt: Date | null
  published: boolean
  slug: string
  category: { slug: string } | null
  tags: Array<{ slug: string }>
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

function throwDraftWriteGuardError(post: DraftWriteGuardPost | null): never {
  if (post && !post.deletedAt && post.published) {
    throw new ConflictError("Draft binding points to a published post")
  }

  throw new NotFoundError("Draft not found")
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
  return prisma.$transaction(async (tx) => {
    const post = await tx.post.create({
      data: {
        title: input.title,
        slug: input.slug,
        content: input.content,
        excerpt: input.excerpt,
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
  return prisma.$transaction(async (tx) => {
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
  const tagConnections = tags.map((tag) => ({ id: tag.id }))
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
