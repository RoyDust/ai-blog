import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { NotFoundError, toErrorResponse } from "@/lib/api-errors"
import { createAdminPost } from "@/lib/ai-authoring"
import { revalidatePublicContent } from "@/lib/cache"
import { prisma } from "@/lib/prisma"
import { parsePostInput } from "@/lib/validation"

function parseIds(searchParams: URLSearchParams) {
  return (searchParams.get("ids") ?? searchParams.getAll("id").join(","))
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
}

export async function GET(request: Request) {
  try {
    await requireAdminSession()

    const { searchParams } = new URL(request.url)

    if (searchParams.get("preview") === "delete") {
      const ids = parseIds(searchParams)

      if (ids.length === 0) {
        return NextResponse.json({ error: "Post IDs are required" }, { status: 400 })
      }

      const [postCount, commentCount] = await Promise.all([
        prisma.post.count({ where: { id: { in: ids }, deletedAt: null } }),
        prisma.comment.count({ where: { postId: { in: ids }, deletedAt: null } }),
      ])

      return NextResponse.json({
        success: true,
        data: {
          title: ids.length > 1 ? "批量隐藏文章" : "隐藏文章",
          description: "隐藏后文章会从前台和后台默认列表移除，且不可直接访问。",
          impacts: [
            { label: "将隐藏文章", value: postCount, unit: "篇" },
            { label: "将连带隐藏评论", value: commentCount, unit: "条" },
          ],
        },
      })
    }

    const posts = await prisma.post.findMany({
      where: { deletedAt: null },
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
        category: true,
        _count: {
          select: { comments: { where: { deletedAt: null } }, likes: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ success: true, data: posts })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAdminSession()
    const input = parsePostInput(await request.json())
    const post = await createAdminPost({ authorId: session.user.id, input })

    return NextResponse.json({ success: true, data: post })
  } catch (error) {
    console.error("Create admin post error:", error)
    return toErrorResponse(error)
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdminSession()

    const { searchParams } = new URL(request.url)
    const ids = parseIds(searchParams)

    if (ids.length === 0) {
      return NextResponse.json({ error: "Post ID is required" }, { status: 400 })
    }

    const posts = await prisma.post.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: {
        id: true,
        slug: true,
        category: { select: { slug: true } },
        tags: { select: { slug: true } },
      },
    })

    if (posts.length === 0) {
      throw new NotFoundError("Post not found")
    }

    const deletedAt = new Date()
    const postIds = posts.map((post) => post.id)

    await prisma.$transaction([
      prisma.post.updateMany({
        where: { id: { in: postIds }, deletedAt: null },
        data: { deletedAt, published: false, publishedAt: null },
      }),
      prisma.comment.updateMany({
        where: { postId: { in: postIds }, deletedAt: null },
        data: { deletedAt },
      }),
    ])

    for (const post of posts) {
      revalidatePublicContent({
        previousSlug: post.slug,
        previousCategorySlug: post.category?.slug,
        previousTagSlugs: post.tags.map((tag) => tag.slug),
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return toErrorResponse(error, "Failed to delete post")
  }
}
