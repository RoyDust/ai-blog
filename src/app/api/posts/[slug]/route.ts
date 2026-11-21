import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { NotFoundError, toErrorResponse } from "@/lib/api-errors"

/**
 * 公开文章详情 API（按 slug 只读访问）。
 *
 * 说明：
 * - 仅返回前台阅读所需的安全公开字段，严禁暴露匿名标识 browserId、authorId 或内部 AI/排期状态列
 * - 纯读接口：浏览量只由 analytics 信标（/api/analytics/visit）累加，避免同一 PV 重复计数
 * - 所有文章写操作统一归口至受管理员鉴权保护的 /api/admin/posts/**
 */
async function GETHandler(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    const post = await prisma.post.findFirst({
      where: { slug, deletedAt: null, published: true },
      select: {
        id: true,
        title: true,
        slug: true,
        content: true,
        excerpt: true,
        seoTitle: true,
        seoDescription: true,
        coverImage: true,
        published: true,
        featured: true,
        viewCount: true,
        readingTimeMinutes: true,
        createdAt: true,
        updatedAt: true,
        publishedAt: true,
        author: {
          select: { id: true, name: true, image: true },
        },
        category: {
          where: { deletedAt: null },
          select: { id: true, name: true, slug: true, description: true },
        },
        tags: {
          where: { deletedAt: null },
          select: { id: true, name: true, slug: true, color: true },
        },
        series: {
          where: { deletedAt: null },
          select: {
            id: true,
            title: true,
            slug: true,
            description: true,
            coverImage: true,
            order: true,
            posts: {
              where: { deletedAt: null, published: true },
              select: { title: true, slug: true, seriesOrder: true },
              orderBy: [{ seriesOrder: "asc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
            },
          },
        },
        comments: {
          where: { parentId: null, status: "APPROVED", deletedAt: null },
          select: {
            id: true,
            content: true,
            authorLabel: true,
            createdAt: true,
            author: {
              select: { id: true, name: true, image: true },
            },
            replies: {
              where: {
                status: "APPROVED",
                deletedAt: null,
                post: { slug, published: true, deletedAt: null },
              },
              select: {
                id: true,
                content: true,
                authorLabel: true,
                createdAt: true,
                author: {
                  select: { id: true, name: true, image: true },
                },
              },
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        _count: {
          select: {
            comments: { where: { deletedAt: null, status: "APPROVED" } },
            likes: true,
          },
        },
      },
    })

    if (!post) {
      throw new NotFoundError("Post not found")
    }

    return NextResponse.json({
      success: true,
      data: post,
    })
  } catch (error) {
    console.error("Get post error:", error)
    return toErrorResponse(error)
  }
}

export const GET = withApiOperationLogging(GETHandler, { scope: 'public', operation: 'public.posts.bySlug.read', route: '/api/posts/[slug]' });
