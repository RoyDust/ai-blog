import { NextResponse } from "next/server"

import { requireAdminSession } from "@/lib/api-auth"
import { NotFoundError, toErrorResponse } from "@/lib/api-errors"
import { prisma } from "@/lib/prisma"
import { parseTaxonomyInput } from "@/lib/validation"

function parseIds(searchParams: URLSearchParams) {
  return (searchParams.get("ids") ?? searchParams.getAll("id").join(","))
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
}

function isConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002"
}

export async function GET(request: Request) {
  try {
    await requireAdminSession()

    const { searchParams } = new URL(request.url)
    if (searchParams.get("preview") === "delete") {
      const ids = parseIds(searchParams)
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

    const categories = await prisma.category.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { posts: { where: { deletedAt: null } } } } },
      orderBy: { name: "asc" },
    })

    return NextResponse.json({ success: true, data: categories })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminSession()
    const { name, slug, description } = parseTaxonomyInput(await request.json())
    const category = await prisma.category.create({ data: { name, slug, description } })

    return NextResponse.json({ success: true, data: category })
  } catch (error) {
    if (isConflict(error)) {
      return NextResponse.json({ error: "Category name or slug already exists" }, { status: 409 })
    }
    return toErrorResponse(error)
  }
}

export async function PATCH(request: Request) {
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
    if (isConflict(error)) {
      return NextResponse.json({ error: "Category name or slug already exists" }, { status: 409 })
    }
    return toErrorResponse(error, "Failed to update category")
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdminSession()

    const { searchParams } = new URL(request.url)
    const ids = parseIds(searchParams)
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
