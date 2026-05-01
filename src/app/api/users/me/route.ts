import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ConflictError, toErrorResponse } from "@/lib/api-errors"
import { requireSession } from "@/lib/api-auth"
import { parseProfileUpdateInput } from "@/lib/validation"

export async function GET() {
  try {
    const session = await requireSession()

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        createdAt: true
      }
    })

    return NextResponse.json({
      success: true,
      data: user
    })
  } catch (error) {
    console.error("Get user error:", error)
    return toErrorResponse(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requireSession()
    const { name, email, image } = parseProfileUpdateInput(await request.json())

    // 检查邮箱是否已被其他用户使用
    if (email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email,
          NOT: { id: session.user.id }
        }
      })

      if (existingUser) {
        throw new ConflictError("Email already in use")
      }
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: { name, email, image },
      select: {
        id: true,
        name: true,
        email: true,
        image: true
      }
    })

    return NextResponse.json({
      success: true,
      data: user
    })
  } catch (error) {
    console.error("Update user error:", error)
    return toErrorResponse(error)
  }
}
