import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { revalidatePublicContent } from "@/lib/cache"
import { prisma } from "@/lib/prisma"

// 切换文章发布状态
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id, published } = await request.json()

    if (!id) {
      return NextResponse.json({ error: "Post ID is required" }, { status: 400 })
    }

    const existing = await prisma.post.findUnique({
      where: { id },
      select: {
        slug: true,
        category: { select: { slug: true } },
        tags: { select: { slug: true } },
      },
    })

    const post = await prisma.post.update({
      where: { id },
      data: {
        published,
        publishedAt: published ? new Date() : null
      },
      select: {
        slug: true,
        published: true,
        category: { select: { slug: true } },
        tags: { select: { slug: true } },
      }
    })

    revalidatePublicContent({
      slug: post.published ? post.slug : null,
      previousSlug: existing?.slug,
      categorySlug: post.published ? post.category?.slug : null,
      previousCategorySlug: existing?.category?.slug,
      tagSlugs: post.published ? post.tags.map((tag) => tag.slug) : [],
      previousTagSlugs: existing?.tags.map((tag) => tag.slug) ?? [],
    })

    return NextResponse.json({ success: true, data: post })
  } catch {
    return NextResponse.json({ error: "Failed to update post" }, { status: 500 })
  }
}
