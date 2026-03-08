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

export async function GET() {
  const session = await assertAdmin()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const posts = await prisma.post.findMany({
    include: {
      author: {
        select: { id: true, name: true, email: true },
      },
      category: true,
      _count: {
        select: { comments: true, likes: true },
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
        tags: tagIds
          ? {
              connect: tagIds.map((id) => ({ id })),
            }
          : undefined,
      },
      include: {
        author: {
          select: { id: true, name: true, image: true },
        },
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
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Post ID is required" }, { status: 400 })
    }

    const post = await prisma.post.findUnique({
      where: { id },
      select: {
        slug: true,
        category: { select: { slug: true } },
        tags: { select: { slug: true } },
      },
    })

    await prisma.post.delete({
      where: { id },
    })

    if (post) {
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
