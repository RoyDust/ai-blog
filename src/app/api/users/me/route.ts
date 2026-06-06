import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ConflictError, toErrorResponse } from "@/lib/api-errors"
import { requireSession } from "@/lib/api-auth"
import { revalidateBlogSettings } from "@/lib/cache"
import { parseProfileUpdateInput } from "@/lib/validation"

async function GETHandler() {
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

async function PATCHHandler(request: Request) {
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

    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: { name, email, image },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true
      }
    })
    if (updatedUser.role === "ADMIN") {
      revalidateBlogSettings()
    }

    const user = {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      image: updatedUser.image
    }

    return NextResponse.json({
      success: true,
      data: user
    })
  } catch (error) {
    console.error("Update user error:", error)
    return toErrorResponse(error)
  }
}

export const GET = withApiOperationLogging(GETHandler, { scope: 'public', operation: 'public.users.me.read', route: '/api/users/me' });
export const PATCH = withApiOperationLogging(PATCHHandler, { scope: 'public', operation: 'public.users.me.update', route: '/api/users/me' });
