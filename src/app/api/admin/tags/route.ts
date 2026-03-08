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
      return NextResponse.json({ error: "Tag IDs are required" }, { status: 400 })
    }

    const [tagCount, postCount] = await Promise.all([
      prisma.tag.count({ where: { id: { in: ids }, deletedAt: null } }),
      prisma.post.count({ where: { deletedAt: null, tags: { some: { id: { in: ids } } } } }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        title: ids.length > 1 ? "批量隐藏标签" : "隐藏标签",
        description: "隐藏后标签会从后台默认列表和前台展示中移除。",
        impacts: [
          { label: "将隐藏标签", value: tagCount, unit: "个" },
          { label: "将影响文章标签展示", value: postCount, unit: "篇" },
        ],
      },
    })
  }

  const tags = await prisma.tag.findMany({
    where: { deletedAt: null },
    include: { _count: { select: { posts: { where: { deletedAt: null } } } } },
    orderBy: { name: "asc" },
  })

  return NextResponse.json({ success: true, data: tags })
}

export async function POST(request: Request) {
  const session = await assertAdmin()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { name, slug, color } = await request.json()
    if (!name || !slug) {
      return NextResponse.json({ error: "Name and slug are required" }, { status: 400 })
    }

    const tag = await prisma.tag.create({ data: { name, slug, color } })

    return NextResponse.json({ success: true, data: tag })
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Tag name or slug already exists" }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const session = await assertAdmin()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { id, name, slug, color } = await request.json()
    if (!id || !name || !slug) {
      return NextResponse.json({ error: "Id, name and slug are required" }, { status: 400 })
    }

    const tag = await prisma.tag.update({
      where: { id },
      data: { name, slug, color },
    })

    return NextResponse.json({ success: true, data: tag })
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Tag name or slug already exists" }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to update tag" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await assertAdmin()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const ids = parseIds(searchParams)
    if (ids.length === 0) {
      return NextResponse.json({ error: "Tag ID is required" }, { status: 400 })
    }

    const tags = await prisma.tag.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true } })
    if (tags.length === 0) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 })
    }

    await prisma.tag.updateMany({ where: { id: { in: tags.map((tag) => tag.id) }, deletedAt: null }, data: { deletedAt: new Date() } })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to delete tag" }, { status: 500 })
  }
}
