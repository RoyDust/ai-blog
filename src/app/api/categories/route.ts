import { NextResponse } from "next/server"
import { UnauthorizedError, toErrorResponse } from "@/lib/api-errors"
import { prisma } from "@/lib/prisma"
import { parseTaxonomyInput } from "@/lib/validation"

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
 * 获取分类列表。
 */
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      where: { deletedAt: null },
      include: {
        _count: {
          select: { posts: { where: { deletedAt: null, published: true } } }
        }
      },
      orderBy: { name: "asc" }
    })

    return NextResponse.json({
      success: true,
      data: categories
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}

/**
 * 创建分类。
 */
export async function POST(request: Request) {
  try {
    const session = await requireAdmin()
    if (!session) {
      throw new UnauthorizedError()
    }

    const { name, slug, description } = parseTaxonomyInput(await request.json())

    const category = await prisma.category.create({
      data: { name, slug, description }
    })

    return NextResponse.json({
      success: true,
      data: category
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
