import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"

import { requireAdminSession } from "@/lib/api-auth"
import { NotFoundError, ValidationError, toErrorResponse } from "@/lib/api-errors"
import { buildAdminListPagination, getAdminListSkip, parseAdminListPagination } from "@/lib/admin-list-pagination"
import { prisma } from "@/lib/prisma"
import { parseCommentStatusInput, parseIdList } from "@/lib/validation"

type CommentStatus = "APPROVED" | "PENDING" | "REJECTED" | "SPAM"

const allowedStatuses = new Set<CommentStatus>(["APPROVED", "PENDING", "REJECTED", "SPAM"])

async function GETHandler(request: Request) {
  try {
    await requireAdminSession()

    const { searchParams } = new URL(request.url)

    if (searchParams.get("preview") === "delete") {
      const ids = parseIdList(searchParams)

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

    const requestedPagination = parseAdminListPagination({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    })
    const query = searchParams.get("q")?.trim()
    const status = searchParams.get("status")?.toUpperCase()
    const where: Prisma.CommentWhereInput = { deletedAt: null }

    if (query) {
      where.OR = [
        { content: { contains: query, mode: "insensitive" } },
        { authorLabel: { contains: query, mode: "insensitive" } },
        { post: { is: { title: { contains: query, mode: "insensitive" } } } },
      ]
    }

    if (status && status !== "ALL") {
      if (!allowedStatuses.has(status as CommentStatus)) {
        throw new ValidationError("Invalid comment status")
      }
      where.status = status as CommentStatus
    }

    const [total, allCount, pendingCount, approvedCount, rejectedCount, spamCount] = await Promise.all([
      prisma.comment.count({ where }),
      prisma.comment.count({ where: { deletedAt: null } }),
      prisma.comment.count({ where: { deletedAt: null, status: "PENDING" } }),
      prisma.comment.count({ where: { deletedAt: null, status: "APPROVED" } }),
      prisma.comment.count({ where: { deletedAt: null, status: "REJECTED" } }),
      prisma.comment.count({ where: { deletedAt: null, status: "SPAM" } }),
    ])
    const pagination = buildAdminListPagination({ ...requestedPagination, total })

    const comments = await prisma.comment.findMany({
      where,
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
      skip: getAdminListSkip(pagination),
      take: pagination.limit,
    })

    return NextResponse.json({
      success: true,
      data: comments,
      pagination,
      stats: {
        total: allCount,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
        spam: spamCount,
      },
    })
  } catch (error) {
    return toErrorResponse(error, "Failed to load comments")
  }
}

async function PATCHHandler(request: Request) {
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

async function DELETEHandler(request: Request) {
  try {
    await requireAdminSession()

    const { searchParams } = new URL(request.url)
    const ids = parseIdList(searchParams)

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

export const GET = withApiOperationLogging(GETHandler, { scope: 'admin', operation: 'admin.comments.read', route: '/api/admin/comments' });
export const PATCH = withApiOperationLogging(PATCHHandler, { scope: 'admin', operation: 'admin.comments.update', route: '/api/admin/comments' });
export const DELETE = withApiOperationLogging(DELETEHandler, { scope: 'admin', operation: 'admin.comments.delete', route: '/api/admin/comments' });
