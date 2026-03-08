import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

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
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

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
}

export async function POST(request: Request) {
  const session = await assertAdmin()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { name, slug, description } = await request.json()
    if (!name || !slug) {
      return NextResponse.json({ error: "Name and slug are required" }, { status: 400 })
    }

    const category = await prisma.category.create({ data: { name, slug, description } })

    return NextResponse.json({ success: true, data: category })
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Category name or slug already exists" }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const session = await assertAdmin()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id, name, slug, description } = await request.json()
    if (!id || !name || !slug) {
      return NextResponse.json({ error: "Id, name and slug are required" }, { status: 400 })
    }

    const category = await prisma.category.update({
      where: { id },
      data: { name, slug, description },
    })

    return NextResponse.json({ success: true, data: category })
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Category name or slug already exists" }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await assertAdmin()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const ids = parseIds(searchParams)
    if (ids.length === 0) {
      return NextResponse.json({ error: "Category ID is required" }, { status: 400 })
    }

    const categories = await prisma.category.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true } })
    if (categories.length === 0) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 })
    }

    const resolvedIds = categories.map((category) => category.id)
    const deletedAt = new Date()

    await prisma.category.updateMany({ where: { id: { in: resolvedIds }, deletedAt: null }, data: { deletedAt } })
    await prisma.post.updateMany({ where: { categoryId: { in: resolvedIds }, deletedAt: null }, data: { categoryId: null } })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to delete category" }, { status: 500 })
  }
}
