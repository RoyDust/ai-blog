import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { NotFoundError, toErrorResponse } from "@/lib/api-errors"
import { revalidatePublicContent } from "@/lib/cache"
import { prisma } from "@/lib/prisma"
import { calculateReadingTimeMinutes } from "@/lib/reading-time"
import { parsePostPatchInput } from "@/lib/validation"

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminSession()

    const { id } = await params
    const post = await prisma.post.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        title: true,
        slug: true,
        content: true,
        excerpt: true,
        coverImage: true,
        readingTimeMinutes: true,
        categoryId: true,
        tags: {
          where: { deletedAt: null },
          select: { id: true, name: true, slug: true },
        },
        published: true,
      },
    })

    if (!post) {
      throw new NotFoundError("Post not found")
    }

    return NextResponse.json({ success: true, data: post })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminSession()

    const { id } = await params
    const body = parsePostPatchInput(await request.json())
    const readingTimeMinutes = calculateReadingTimeMinutes(body.content)
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
        title: body.title,
        slug: body.slug,
        content: body.content,
        excerpt: body.excerpt,
        coverImage: body.coverImage,
        readingTimeMinutes,
        categoryId: body.categoryId,
        tags: body.tagIds
          ? {
              set: body.tagIds.map((tagId: string) => ({ id: tagId })),
            }
          : undefined,
        published: body.published,
        publishedAt: body.published ? new Date() : null,
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

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    return toErrorResponse(error)
  }
}
