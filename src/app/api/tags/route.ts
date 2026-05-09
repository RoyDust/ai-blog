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
 * 获取标签列表。
 */
export async function GET() {
  try {
    const tags = await prisma.tag.findMany({
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
      data: tags
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}

/**
 * 创建标签。
 */
export async function POST(request: Request) {
  try {
    const session = await requireAdmin()
    if (!session) {
      throw new UnauthorizedError()
    }

    const { name, slug, color } = parseTaxonomyInput(await request.json())

    const tag = await prisma.tag.create({
      data: { name, slug, color }
    })

    return NextResponse.json({
      success: true,
      data: tag
    })
  } catch (error) {
    return toErrorResponse(error)
  }
}
