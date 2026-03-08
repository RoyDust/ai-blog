import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { revalidatePublicContent } from "@/lib/cache"
import { prisma } from "@/lib/prisma"
import { parsePostInput } from "@/lib/validation"

async function assertAdmin() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return null
  }

  return session
}

function parseIds(searchParams: URLSearchParams) {
  return (searchParams.get("ids") ?? searchParams.getAll("id").join(","))
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
}

export async function GET(request: Request) {
  const session = await assertAdmin()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

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
}

export async function POST(request: Request) {
  const session = await assertAdmin()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { title, content, slug, excerpt, coverImage, categoryId, tagIds, published } = parsePostInput(await request.json())

    const post = await prisma.post.create({
      data: {
        title,
        content,
        slug,
        excerpt,
        coverImage,
        categoryId,
        published,
        publishedAt: published ? new Date() : null,
        authorId: session.user.id,
        tags: tagIds ? { connect: tagIds.map((id) => ({ id })) } : undefined,
      },
      include: {
        author: { select: { id: true, name: true, image: true } },
        category: true,
        tags: true,
      },
    })

    if (post.published) {
      revalidatePublicContent({
        slug: post.slug,
        categorySlug: post.category?.slug,
        tagSlugs: post.tags.map((tag) => tag.slug),
      })
    }

    return NextResponse.json({ success: true, data: post })
  } catch (error) {
    if (error instanceof Error && (error.message.startsWith("Invalid") || error.message === "Title and content are required")) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error("Create admin post error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await assertAdmin()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
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
      return NextResponse.json({ error: "Post not found" }, { status: 404 })
    }

    const deletedAt = new Date()

    await prisma.post.updateMany({
      where: { id: { in: posts.map((post) => post.id) }, deletedAt: null },
      data: { deletedAt, published: false, publishedAt: null },
    })
    await prisma.comment.updateMany({
      where: { postId: { in: posts.map((post) => post.id) }, deletedAt: null },
      data: { deletedAt },
    })

    for (const post of posts) {
      revalidatePublicContent({
        previousSlug: post.slug,
        previousCategorySlug: post.category?.slug,
        previousTagSlugs: post.tags.map((tag) => tag.slug),
      })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to delete post" }, { status: 500 })
  }
}
