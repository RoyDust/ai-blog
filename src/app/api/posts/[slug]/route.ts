import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { revalidatePublicContent } from "@/lib/cache"
import { parsePostPatchInput } from "@/lib/validation"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    const post = await prisma.post.findUnique({
      where: { slug },
      include: {
        author: {
          select: { id: true, name: true, image: true }
        },
        category: true,
        tags: true,
        comments: {
          where: { parentId: null },
          include: {
            author: {
              select: { id: true, name: true, image: true }
            },
            replies: {
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
          select: { comments: true, likes: true }
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
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { slug } = await params
    const { title, content, excerpt, coverImage, categoryId, tagIds, published } = parsePostPatchInput(await request.json())

    const post = await prisma.post.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        authorId: true,
        category: { select: { slug: true } },
        tags: { select: { slug: true } },
      }
    })

    if (!post) {
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      )
    }

    // 检查权限
    if (post.authorId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const updateData = {
      title,
      content,
      excerpt,
      coverImage,
      categoryId,
      ...(typeof published === "boolean" ? { published } : {}),
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
      tagSlugs: updatedPost.published ? updatedPost.tags.map((tag) => tag.slug) : [],
      previousTagSlugs: post.tags.map((tag) => tag.slug),
    })

    return NextResponse.json({
      success: true,
      data: updatedPost
    })
  } catch (error) {
    if (error instanceof Error && (error.message.startsWith("Invalid") || error.message === "Title and content are required")) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error("Update post error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { slug } = await params

    const post = await prisma.post.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        authorId: true,
        category: { select: { slug: true } },
        tags: { select: { slug: true } },
      }
    })

    if (!post) {
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      )
    }

    // 检查权限
    if (post.authorId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    await prisma.post.delete({
      where: { id: post.id }
    })

    revalidatePublicContent({
      previousSlug: post.slug,
      previousCategorySlug: post.category?.slug,
      previousTagSlugs: post.tags.map((tag) => tag.slug),
    })

    return NextResponse.json({
      success: true,
      message: "Post deleted"
    })
  } catch (error) {
    console.error("Delete post error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
