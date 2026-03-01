import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// 获取所有评论
export async function GET() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const comments = await prisma.comment.findMany({
    include: {
      author: {
        select: { id: true, name: true, email: true, image: true }
      },
      post: {
        select: { id: true, title: true, slug: true }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 100
  })

  return NextResponse.json({ success: true, data: comments })
}

// 删除评论
export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: "Comment ID is required" }, { status: 400 })
    }

    await prisma.comment.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 })
  }
}
