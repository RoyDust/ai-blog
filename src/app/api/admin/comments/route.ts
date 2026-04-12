import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { NotFoundError, ValidationError, toErrorResponse } from "@/lib/api-errors"
import { prisma } from "@/lib/prisma"
import { parseCommentStatusInput } from "@/lib/validation"

type CommentStatus = "APPROVED" | "PENDING" | "REJECTED" | "SPAM"

const allowedStatuses = new Set<CommentStatus>(["APPROVED", "PENDING", "REJECTED", "SPAM"])

function parseIds(searchParams: URLSearchParams) {
  return (searchParams.get("ids") ?? searchParams.getAll("id").join(","))
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
}

export async function GET(request: Request) {
  try {
    await requireAdminSession()

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
    if (error instanceof Error && process.env.NODE_ENV !== "production" && !(error instanceof ValidationError)) {
      return NextResponse.json({ error: "Failed to load comments", detail: error.message }, { status: 500 })
    }
    return toErrorResponse(error, "Failed to load comments")
  }
}

export async function PATCH(request: Request) {
  try {
    await requireAdminSession()

    const { ids, status } = parseCommentStatusInput(await request.json())

    if (ids.length === 0) {
      throw new ValidationError("Comment IDs are required")
    }

    if (!allowedStatuses.has(status as CommentStatus)) {
      throw new ValidationError("Invalid comment status")
    }

    await prisma.comment.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { status: status as CommentStatus },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    return toErrorResponse(error, "Failed to update comment status")
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdminSession()

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
      throw new NotFoundError("Comment not found")
    }

    const deletedAt = new Date()
    const resolvedIds = comments.map((comment: { id: string }) => comment.id)

    await prisma.$transaction([
      prisma.comment.updateMany({
        where: {
          deletedAt: null,
          OR: [{ id: { in: resolvedIds } }, { parentId: { in: resolvedIds } }],
        },
        data: { deletedAt },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    return toErrorResponse(error, "Failed to delete comment")
  }
}
