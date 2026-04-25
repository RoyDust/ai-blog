import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { revalidatePublicContent } from "@/lib/cache"
import { parsePostPatchInput } from "@/lib/validation"
import { canPublish, requireSession } from "@/lib/api-auth"
import { ForbiddenError, NotFoundError, toErrorResponse } from "@/lib/api-errors"
import { getOptionalSummaryFieldsForExcerpt } from "@/lib/post-summary-status"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    const post = await prisma.post.findFirst({
      where: { slug, deletedAt: null, published: true },
      include: {
        author: {
          select: { id: true, name: true, image: true }
        },
        category: true,
        tags: { where: { deletedAt: null } },
        comments: {
          where: { parentId: null, status: "APPROVED", deletedAt: null },
          include: {
            author: {
              select: { id: true, name: true, image: true }
            },
            replies: {
              where: { status: "APPROVED", deletedAt: null },
              include: {
                author: {
                  select: { id: true, name: true, image: true }
                }
              }
            }
          },
          orderBy: { createdAt: "desc" }
        },
        _count: {
          select: { comments: { where: { deletedAt: null } }, likes: true }
        }
      }
    })

    if (!post) {
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      )
    }

    // 增加浏览量
    await prisma.post.update({
      where: { id: post.id },
      data: { viewCount: { increment: 1 } }
    })

    return NextResponse.json({
      success: true,
      data: post
    })
  } catch (error) {
    console.error("Get post error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await requireSession()

    const { slug } = await params
    const { title, content, slug: nextSlug, excerpt, coverImage, categoryId, tagIds, published } = parsePostPatchInput(await request.json())

    const post = await prisma.post.findFirst({
      where: { slug, deletedAt: null },
      select: {
        id: true,
        slug: true,
        authorId: true,
        category: { select: { slug: true } },
        tags: { select: { slug: true } },
      }
    })

    if (!post) {
      throw new NotFoundError("Post not found")
    }

    if (post.authorId !== session.user.id && session.user.role !== "ADMIN") {
      throw new ForbiddenError()
    }

    const publishNow = typeof published === "boolean" ? (canPublish(session) ? published : false) : undefined

    const updateData = {
      title,
      content,
      ...(nextSlug ? { slug: nextSlug } : {}),
      excerpt,
      ...getOptionalSummaryFieldsForExcerpt(excerpt),
      coverImage,
      categoryId,
      ...(typeof publishNow === "boolean" ? { published: publishNow, publishedAt: publishNow ? new Date() : null } : {}),
      tags: tagIds ? {
        set: tagIds.map((id: string) => ({ id }))
      } : undefined
    }

    const updatedPost = await prisma.post.update({
      where: { id: post.id },
      data: updateData,
      include: {
        author: {
          select: { id: true, name: true, image: true }
        },
        category: true,
        tags: true
      }
    })

    revalidatePublicContent({
      slug: updatedPost.published ? updatedPost.slug : null,
      previousSlug: post.slug,
      categorySlug: updatedPost.published ? updatedPost.category?.slug : null,
      previousCategorySlug: post.category?.slug,
      tagSlugs: updatedPost.published ? updatedPost.tags.map((tag: { slug: string }) => tag.slug) : [],
      previousTagSlugs: post.tags.map((tag: { slug: string }) => tag.slug),
    })

    return NextResponse.json({
      success: true,
      data: updatedPost
    })
  } catch (error) {
    console.error("Update post error:", error)
    return toErrorResponse(error)
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await requireSession()

    const { slug } = await params

    const post = await prisma.post.findFirst({
      where: { slug, deletedAt: null },
      select: {
        id: true,
        slug: true,
        authorId: true,
        category: { select: { slug: true } },
        tags: { select: { slug: true } },
      }
    })

    if (!post) {
      throw new NotFoundError("Post not found")
    }

    if (post.authorId !== session.user.id && session.user.role !== "ADMIN") {
      throw new ForbiddenError()
    }

    await prisma.post.update({
      where: { id: post.id },
      data: { deletedAt: new Date(), published: false, publishedAt: null }
    })

    revalidatePublicContent({
      previousSlug: post.slug,
      previousCategorySlug: post.category?.slug,
      previousTagSlugs: post.tags.map((tag: { slug: string }) => tag.slug),
    })

    return NextResponse.json({
      success: true,
      message: "Post deleted"
    })
  } catch (error) {
    console.error("Delete post error:", error)
    return toErrorResponse(error)
  }
}
