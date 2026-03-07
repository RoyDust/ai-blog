import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

/**
 * 仅在写操作时按需加载鉴权配置，避免公共 GET 因 auth 配置问题被连带打崩。
 */
async function requireAdmin() {
  const { getServerSession } = await import("next-auth")
  const { authOptions } = await import("@/lib/auth")
  const session = await getServerSession(authOptions)

  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return null
  }

  return session
}

/**
 * 获取标签列表。
 */
export async function GET() {
  try {
    const tags = await prisma.tag.findMany({
      include: {
        _count: {
          select: { posts: true }
        }
      },
      orderBy: { name: "asc" }
    })

    return NextResponse.json({
      success: true,
      data: tags
    })
  } catch (error) {
    console.error("Get tags error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

/**
 * 创建标签。
 */
export async function POST(request: Request) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { name, slug, color } = await request.json()

    if (!name || !slug) {
      return NextResponse.json(
        { error: "Name and slug are required" },
        { status: 400 }
      )
    }

    const tag = await prisma.tag.create({
      data: { name, slug, color }
    })

    return NextResponse.json({
      success: true,
      data: tag
    })
  } catch (error) {
    console.error("Create tag error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
