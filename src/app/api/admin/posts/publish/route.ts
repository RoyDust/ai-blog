import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { NotFoundError, toErrorResponse } from "@/lib/api-errors"
import { revalidatePublicContent } from "@/lib/cache"
import { prisma } from "@/lib/prisma"
import { parsePublishInput } from "@/lib/validation"

export async function PATCH(request: Request) {
  try {
    await requireAdminSession()
    const { id, published } = parsePublishInput(await request.json())

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

    const post = await prisma.post.update({
      where: { id },
      data: {
        published,
        publishedAt: published ? new Date() : null,
      },
      select: {
        slug: true,
        published: true,
        category: { select: { slug: true } },
        tags: { where: { deletedAt: null }, select: { slug: true } },
      },
    })

    revalidatePublicContent({
      slug: post.published ? post.slug : null,
      previousSlug: existing.slug,
      categorySlug: post.published ? post.category?.slug : null,
      previousCategorySlug: existing.category?.slug,
      tagSlugs: post.published ? post.tags.map((tag: { slug: string }) => tag.slug) : [],
      previousTagSlugs: existing.tags.map((tag: { slug: string }) => tag.slug) ?? [],
    })

    return NextResponse.json({ success: true, data: post })
  } catch (error) {
    return toErrorResponse(error, "Failed to update post")
  }
}
