import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { revalidatePublicContent } from "@/lib/cache"
import { parsePostPatchInput } from "@/lib/validation"
import { canPublish, requireSession } from "@/lib/api-auth"
import { ForbiddenError, NotFoundError, toErrorResponse } from "@/lib/api-errors"
import { getOptionalSummaryFieldsForExcerpt } from "@/lib/post-summary-status"

/**
 * 文章详情 API（按 slug 访问）。
 *
 * 这里同时承担三类职责：
 * - GET：返回公开文章详情，并累加浏览量
 * - PATCH：作者或管理员更新文章内容，并刷新受影响的公共页面缓存
 * - DELETE：软删除文章，避免直接物理删除历史数据
 *
 * 说明：
 * - 这里的 slug 是路由层主键，更新时仍通过查询结果里的真实 id 落库
 * - PATCH / DELETE 都需要先验证登录态，再校验资源归属或管理员身份
 */

/**
 * 返回已发布文章的公开详情。
 *
 * 副作用：
 * - 读取文章、作者、分类、标签、评论与点赞数量
 * - 成功返回后会把 viewCount +1
 */
async function GETHandler(
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
          select: { comments: { where: { deletedAt: null, status: "APPROVED" } }, likes: true }
        }
      }
    })

    if (!post) {
      return NextResponse.json(
        { error: "Post not found" },
        { status: 404 }
      )
    }

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

/**
 * 更新文章内容。
 *
 * 权限规则：
 * - 文章作者可编辑自己的文章
 * - 管理员可编辑任意文章
 * - 只有管理员能真正控制 published 状态
 *
 * 副作用：
 * - 更新文章主体、摘要、封面、分类、标签
 * - 当 slug / 分类 / 标签 / 发布状态变化时，刷新前台缓存路径
 */
async function PATCHHandler(
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

    // 作者可以提交 published 字段，但真正生效与否由角色决定。
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

/**
 * 软删除文章。
 *
 * 说明：
 * - 不直接删除数据库记录，而是写入 deletedAt 并取消发布
 * - 删除后同步清理前台依赖该文章的路径缓存
 */
async function DELETEHandler(
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

export const GET = withApiOperationLogging(GETHandler, { scope: 'public', operation: 'public.posts.bySlug.read', route: '/api/posts/[slug]' });
export const PATCH = withApiOperationLogging(PATCHHandler, { scope: 'public', operation: 'public.posts.bySlug.update', route: '/api/posts/[slug]' });
export const DELETE = withApiOperationLogging(DELETEHandler, { scope: 'public', operation: 'public.posts.bySlug.delete', route: '/api/posts/[slug]' });
