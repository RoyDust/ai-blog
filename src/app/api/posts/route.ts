import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { revalidatePublicContent } from "@/lib/cache"
import { getPublishedPostsPage } from "@/lib/posts"
import { clampPagination, parsePostInput } from "@/lib/validation"
import { canPublish, requireSession } from "@/lib/api-auth"
import { toErrorResponse } from "@/lib/api-errors"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const { page, limit } = clampPagination({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    })
    const category = searchParams.get("category")
    const tag = searchParams.get("tag")
    const search = searchParams.get("search")

    const { posts, pagination } = await getPublishedPostsPage({ page, limit, category, tag, search })

    return NextResponse.json({
      success: true,
      data: posts,
      pagination,
    })
  } catch (error) {
    console.error("Get posts error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession()

    const { title, content, slug, excerpt, coverImage, categoryId, tagIds, published } = parsePostInput(await request.json())
    const publishNow = canPublish(session) && published

    const post = await prisma.post.create({
      data: {
        title,
        content,
        slug,
        excerpt,
        coverImage,
        categoryId,
        published: publishNow,
        publishedAt: publishNow ? new Date() : null,
        authorId: session.user.id,
        tags: tagIds ? {
          connect: tagIds.map((id: string) => ({ id }))
        } : undefined
      },
      include: {
        author: {
          select: { id: true, name: true, image: true }
        },
        category: true,
        tags: true
      }
    })

    if (publishNow) {
      revalidatePublicContent({
        slug: post.slug,
        categorySlug: post.category?.slug,
        tagSlugs: post.tags.map((tag: { slug: string }) => tag.slug),
      })
    }

    return NextResponse.json({
      success: true,
      data: post
    })
  } catch (error) {
    console.error("Create post error:", error)
    return toErrorResponse(error)
  }
}
