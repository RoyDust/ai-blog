import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { revalidatePublicContent } from "@/lib/cache"
import { prisma } from "@/lib/prisma"

// 获取所有文章
export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const posts = await prisma.post.findMany({
    include: {
      author: {
        select: { id: true, name: true, email: true }
      },
      category: true,
      _count: {
        select: { comments: true, likes: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  return NextResponse.json({ success: true, data: posts })
}

// 删除文章
export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

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
      where: { id }
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
