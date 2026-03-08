import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import type { CommentStatus } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const allowedStatuses = new Set<CommentStatus>(["APPROVED", "PENDING", "REJECTED", "SPAM"])

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

  try {
    const { searchParams } = new URL(request.url)

    if (searchParams.get("preview") === "delete") {
      const ids = parseIds(searchParams)

      if (ids.length === 0) {
        return NextResponse.json({ error: "Comment IDs are required" }, { status: 400 })
      }

      const [commentCount, replyCount] = await Promise.all([
        prisma.comment.count({ where: { id: { in: ids }, deletedAt: null } }),
        prisma.comment.count({ where: { parentId: { in: ids }, deletedAt: null } }),
      ])

      return NextResponse.json({
        success: true,
        data: {
          title: ids.length > 1 ? "批量隐藏评论" : "隐藏评论",
          description: "隐藏后评论会从前台和后台默认列表移除。",
          impacts: [
            { label: "将隐藏评论", value: commentCount, unit: "条" },
            { label: "将连带隐藏回复", value: replyCount, unit: "条" },
          ],
        },
      })
    }

    const comments = await prisma.comment.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        content: true,
        createdAt: true,
        status: true,
        authorLabel: true,
        author: {
          select: { id: true, name: true, email: true, image: true },
        },
        post: {
          select: { id: true, title: true, slug: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    })

    return NextResponse.json({ success: true, data: comments })
  } catch (error) {
    console.error("Get admin comments error:", error)
    return NextResponse.json(
      {
        error: "Failed to load comments",
        ...(process.env.NODE_ENV !== "production" && error instanceof Error ? { detail: error.message } : {}),
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  const session = await assertAdmin()

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as { ids?: unknown; status?: unknown }
    const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === "string" && id.trim().length > 0) : []
    const status = typeof body.status === "string" ? (body.status.toUpperCase() as CommentStatus) : null

    if (ids.length === 0) {
      return NextResponse.json({ error: "Comment IDs are required" }, { status: 400 })
    }

    if (!status || !allowedStatuses.has(status)) {
      return NextResponse.json({ error: "Invalid comment status" }, { status: 400 })
    }

    await prisma.comment.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { status },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to update comment status" }, { status: 500 })
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
      return NextResponse.json({ error: "Comment ID is required" }, { status: 400 })
    }

    const comments = await prisma.comment.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: { id: true },
    })

    if (comments.length === 0) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 })
    }

    const deletedAt = new Date()
    const resolvedIds = comments.map((comment) => comment.id)

    await prisma.comment.updateMany({
      where: {
        deletedAt: null,
        OR: [{ id: { in: resolvedIds } }, { parentId: { in: resolvedIds } }],
      },
      data: { deletedAt },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to delete comment" }, { status: 500 })
  }
}
