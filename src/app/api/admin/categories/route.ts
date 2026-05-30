import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"

import { requireAdminSession } from "@/lib/api-auth"
import { isPrismaConflictError, NotFoundError, toErrorResponse } from "@/lib/api-errors"
import { buildAdminListPagination, getAdminListSkip, parseAdminListPagination } from "@/lib/admin-list-pagination"
import { prisma } from "@/lib/prisma"
import { parseIdList, parseTaxonomyInput } from "@/lib/validation"

async function GETHandler(request: Request) {
  try {
    await requireAdminSession()

    const { searchParams } = new URL(request.url)
    if (searchParams.get("preview") === "delete") {
      const ids = parseIdList(searchParams)
      if (ids.length === 0) {
        return NextResponse.json({ error: "Category IDs are required" }, { status: 400 })
      }

      const [categoryCount, postCount] = await Promise.all([
        prisma.category.count({ where: { id: { in: ids }, deletedAt: null } }),
        prisma.post.count({ where: { categoryId: { in: ids }, deletedAt: null } }),
      ])

      return NextResponse.json({
        success: true,
        data: {
          title: ids.length > 1 ? "批量隐藏分类" : "隐藏分类",
          description: "隐藏后分类会从后台默认列表和前台导航中移除。",
          impacts: [
            { label: "将隐藏分类", value: categoryCount, unit: "个" },
            { label: "将让文章失去分类归属", value: postCount, unit: "篇" },
          ],
        },
      })
    }

    const requestedPagination = parseAdminListPagination({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
    })
    const query = searchParams.get("q")?.trim()
    const where: Prisma.CategoryWhereInput = { deletedAt: null }

    if (query) {
      where.OR = [
        { name: { contains: query, mode: "insensitive" } },
        { slug: { contains: query, mode: "insensitive" } },
      ]
    }

    const total = await prisma.category.count({ where })
    const pagination = buildAdminListPagination({ ...requestedPagination, total })

    const categories = await prisma.category.findMany({
      where,
      include: { _count: { select: { posts: { where: { deletedAt: null } } } } },
      orderBy: { name: "asc" },
      skip: getAdminListSkip(pagination),
      take: pagination.limit,
    })

    return NextResponse.json({ success: true, data: categories, pagination })
  } catch (error) {
    return toErrorResponse(error)
  }
}

async function POSTHandler(request: Request) {
  try {
    await requireAdminSession()
    const { name, slug, description } = parseTaxonomyInput(await request.json())
    const category = await prisma.category.create({ data: { name, slug, description } })

    return NextResponse.json({ success: true, data: category })
  } catch (error) {
    if (isPrismaConflictError(error)) {
      return NextResponse.json({ error: "Category name or slug already exists" }, { status: 409 })
    }
    return toErrorResponse(error)
  }
}

async function PATCHHandler(request: Request) {
  try {
    await requireAdminSession()
    const { id, name, slug, description } = parseTaxonomyInput(await request.json())

    if (!id) {
      return NextResponse.json({ error: "Id is required" }, { status: 400 })
    }

    const category = await prisma.category.update({
      where: { id },
      data: { name, slug, description },
    })

    return NextResponse.json({ success: true, data: category })
  } catch (error) {
    if (isPrismaConflictError(error)) {
      return NextResponse.json({ error: "Category name or slug already exists" }, { status: 409 })
    }
    return toErrorResponse(error, "Failed to update category")
  }
}

async function DELETEHandler(request: Request) {
  try {
    await requireAdminSession()

    const { searchParams } = new URL(request.url)
    const ids = parseIdList(searchParams)
    if (ids.length === 0) {
      return NextResponse.json({ error: "Category ID is required" }, { status: 400 })
    }

    const categories = await prisma.category.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true } })
    if (categories.length === 0) {
      throw new NotFoundError("Category not found")
    }

    const resolvedIds = categories.map((category: { id: string }) => category.id)
    const deletedAt = new Date()

    await prisma.$transaction([
      prisma.category.updateMany({ where: { id: { in: resolvedIds }, deletedAt: null }, data: { deletedAt } }),
      prisma.post.updateMany({ where: { categoryId: { in: resolvedIds }, deletedAt: null }, data: { categoryId: null } }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    return toErrorResponse(error, "Failed to delete category")
  }
}

export const GET = withApiOperationLogging(GETHandler, { scope: 'admin', operation: 'admin.categories.read', route: '/api/admin/categories' });
export const POST = withApiOperationLogging(POSTHandler, { scope: 'admin', operation: 'admin.categories.create', route: '/api/admin/categories' });
export const PATCH = withApiOperationLogging(PATCHHandler, { scope: 'admin', operation: 'admin.categories.update', route: '/api/admin/categories' });
export const DELETE = withApiOperationLogging(DELETEHandler, { scope: 'admin', operation: 'admin.categories.delete', route: '/api/admin/categories' });
