import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { revalidatePublicContent } from "@/lib/cache"
import { getPublishedPostsPage } from "@/lib/posts"
import { clampPagination, parsePostInput } from "@/lib/validation"

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
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { title, content, slug, excerpt, coverImage, categoryId, tagIds, published } = parsePostInput(await request.json())

    const post = await prisma.post.create({
      data: {
        title,
        content,
        slug,
        excerpt,
        coverImage,
        categoryId,
        published: published || false,
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

    if (post.published) {
      revalidatePublicContent({
        slug: post.slug,
        categorySlug: post.category?.slug,
        tagSlugs: post.tags.map((tag) => tag.slug),
      })
    }

    return NextResponse.json({
      success: true,
      data: post
    })
  } catch (error) {
    if (error instanceof Error && (error.message.startsWith("Invalid") || error.message === "Title and content are required")) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error("Create post error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
