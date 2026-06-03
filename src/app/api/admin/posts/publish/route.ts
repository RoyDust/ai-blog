import { NextResponse } from "next/server"

import { withApiOperationLogging } from "@/lib/api-operation-log-route"
import { requireAdminSession } from "@/lib/api-auth"
import { NotFoundError, toErrorResponse } from "@/lib/api-errors"
import { revalidatePublicContent } from "@/lib/cache"
import { resolvePostCoverInput, touchCoverAssetUsage } from "@/lib/cover-assets"
import { prisma } from "@/lib/prisma"
import { parsePublishInput } from "@/lib/validation"

type PublishPostContext = {
  slug: string
  coverImage: string | null
  coverAssetId: string | null
  category?: { slug: string } | null
  series?: { slug: string } | null
  tags: Array<{ slug: string }>
}

const existingPostSelect = {
  id: true,
  slug: true,
  coverImage: true,
  coverAssetId: true,
  category: { select: { slug: true } },
  series: { select: { slug: true } },
  tags: { where: { deletedAt: null }, select: { slug: true } },
} as const

const updatedPostSelect = {
  slug: true,
  published: true,
  coverImage: true,
  coverAssetId: true,
  category: { select: { slug: true } },
  series: { select: { slug: true } },
  tags: { where: { deletedAt: null }, select: { slug: true } },
} as const

async function updatePostPublishState({
  id,
  existing,
  published,
  scheduledAt,
  now,
}: {
  id: string
  existing: PublishPostContext
  published: boolean
  scheduledAt: Date | null | undefined
  now: Date
}) {
  const cover =
    published && !existing.coverImage?.trim()
      ? await resolvePostCoverInput({
          coverImage: existing.coverImage,
          coverAssetId: existing.coverAssetId,
          allowRandom: true,
        })
      : null

  const post = await prisma.post.update({
    where: { id },
    data: {
      published: scheduledAt ? false : published,
      publishedAt: published ? now : null,
      scheduledAt: scheduledAt ?? null,
      ...(cover?.coverImage !== undefined ? { coverImage: cover.coverImage } : {}),
      ...(cover?.coverAssetId !== undefined ? { coverAssetId: cover.coverAssetId } : {}),
    },
    select: updatedPostSelect,
  })

  await touchCoverAssetUsage(cover?.selectedAssetId)

  revalidatePublicContent({
    slug: post.published ? post.slug : null,
    previousSlug: existing.slug,
    categorySlug: post.published ? post.category?.slug : null,
    previousCategorySlug: existing.category?.slug,
    seriesSlug: post.published ? post.series?.slug : null,
    previousSeriesSlug: existing.series?.slug,
    tagSlugs: post.published ? post.tags.map((tag: { slug: string }) => tag.slug) : [],
    previousTagSlugs: existing.tags.map((tag: { slug: string }) => tag.slug) ?? [],
  })

  return post
}

async function PATCHHandler(request: Request) {
  try {
    await requireAdminSession()
    const { id, ids, published, scheduledAt } = parsePublishInput(await request.json())
    const now = new Date()

    if (published && scheduledAt) {
      return NextResponse.json({ error: "Use immediate publish without scheduledAt, or schedule with published=false" }, { status: 400 })
    }

    if (!published && scheduledAt && scheduledAt.getTime() <= now.getTime()) {
      return NextResponse.json({ error: "scheduledAt must be in the future. Use immediate publish for current or past publish times." }, { status: 400 })
    }

    if (ids.length > 1) {
      const existingPosts = await prisma.post.findMany({
        where: { id: { in: ids }, deletedAt: null },
        select: existingPostSelect,
      })

      if (existingPosts.length === 0) {
        throw new NotFoundError("Post not found")
      }

      const posts = []
      for (const existing of existingPosts) {
        posts.push(await updatePostPublishState({ id: existing.id, existing, published, scheduledAt, now }))
      }

      return NextResponse.json({ success: true, data: { count: posts.length, posts } })
    }

    const existing = await prisma.post.findFirst({
      where: { id, deletedAt: null },
      select: existingPostSelect,
    })

    if (!existing) {
      throw new NotFoundError("Post not found")
    }

    const post = await updatePostPublishState({ id, existing, published, scheduledAt, now })

    return NextResponse.json({ success: true, data: post })
  } catch (error) {
    return toErrorResponse(error, "Failed to update post")
  }
}

export const PATCH = withApiOperationLogging(PATCHHandler, { scope: 'admin', operation: 'admin.posts.publish.update', route: '/api/admin/posts/publish' });
