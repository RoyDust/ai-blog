import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"

import { requireAdminSession } from "@/lib/api-auth"
import { NotFoundError, toErrorResponse } from "@/lib/api-errors"
import { buildAdminListPagination, getAdminListSkip, parseAdminListPagination } from "@/lib/admin-list-pagination"
import { createAdminPost } from "@/lib/ai-authoring"
import { revalidatePublicContent } from "@/lib/cache"
import { prisma } from "@/lib/prisma"
import { parseIdList, parsePostInput } from "@/lib/validation"

async function GETHandler(request: Request) {
  try {
    await requireAdminSession()

    const { searchParams } = new URL(request.url)

    if (searchParams.get("preview") === "delete") {
      const ids = parseIdList(searchParams)

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
          title: ids.length > 1 ? "批量删除文章" : "删除文章",
          description: "删除后文章会从前台和后台默认列表移除，且不可直接访问；系统会保留记录用于审计和关联恢复。",
          impacts: [
            { label: "将删除文章", value: postCount, unit: "篇" },
            { label: "将连带隐藏评论", value: commentCount, unit: "条" },
          ],
        },
      })
    }

    const requestedPagination = parseAdminListPagination({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    })
    const query = searchParams.get("q")?.trim()
    const status = searchParams.get("status")
    const where: Prisma.PostWhereInput = { deletedAt: null }

    if (query) {
      where.OR = [
        { title: { contains: query, mode: "insensitive" } },
        { slug: { contains: query, mode: "insensitive" } },
      ]
    }

    if (status === "published") {
      where.published = true
    } else if (status === "draft") {
      where.published = false
    }

    const [total, allCount, publishedCount, viewAggregate] = await Promise.all([
      prisma.post.count({ where }),
      prisma.post.count({ where: { deletedAt: null } }),
      prisma.post.count({ where: { deletedAt: null, published: true } }),
      prisma.post.aggregate({ where: { deletedAt: null }, _sum: { viewCount: true } }),
    ])
    const pagination = buildAdminListPagination({ ...requestedPagination, total })

    const posts = await prisma.post.findMany({
      where,
      include: {
        author: {
          select: { id: true, name: true, email: true },
        },
        category: true,
        series: { select: { id: true, title: true, slug: true } },
        _count: {
          select: { comments: { where: { deletedAt: null } }, likes: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: getAdminListSkip(pagination),
      take: pagination.limit,
    })

    return NextResponse.json({
      success: true,
      data: posts,
      pagination,
      stats: {
        total: allCount,
        published: publishedCount,
        drafts: allCount - publishedCount,
        views: viewAggregate._sum.viewCount ?? 0,
      },
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}

async function POSTHandler(request: Request) {
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

async function DELETEHandler(request: Request) {
  try {
    await requireAdminSession()

    const { searchParams } = new URL(request.url)
    const ids = parseIdList(searchParams)

    if (ids.length === 0) {
      return NextResponse.json({ error: "Post ID is required" }, { status: 400 })
    }

    const posts = await prisma.post.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: {
        id: true,
        slug: true,
        category: { select: { slug: true } },
        series: { select: { slug: true } },
        tags: { select: { slug: true } },
      },
    })

    if (posts.length === 0) {
      throw new NotFoundError("Post not found")
    }

    const deletedAt = new Date()
    const postIds = posts.map((post: { id: string }) => post.id)

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
        previousSeriesSlug: post.series?.slug,
        previousTagSlugs: post.tags.map((tag: { slug: string }) => tag.slug),
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return toErrorResponse(error, "Failed to delete post")
  }
}

export const GET = withApiOperationLogging(GETHandler, { scope: 'admin', operation: 'admin.posts.read', route: '/api/admin/posts' });
export const POST = withApiOperationLogging(POSTHandler, { scope: 'admin', operation: 'admin.posts.create', route: '/api/admin/posts' });
export const DELETE = withApiOperationLogging(DELETEHandler, { scope: 'admin', operation: 'admin.posts.delete', route: '/api/admin/posts' });
