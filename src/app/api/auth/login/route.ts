import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { parseLoginInput } from "@/lib/validation"
import { checkAuthRateLimit } from "@/lib/rate-limit"
import { toErrorResponse } from "@/lib/api-errors"

/**
 * 校验登录输入并返回当前账号的基础信息。
 */
export async function POST(request: Request) {
  try {
    const rateLimit = await checkAuthRateLimit(request)
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const { email, password } = parseLoginInput(await request.json())

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user || !user.password) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      }
    })
  } catch (error) {
    console.error("Login error:", error)
    return toErrorResponse(error)
  }
}
