import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { parseRegisterInput } from "@/lib/validation"
import { checkAuthRateLimit } from "@/lib/rate-limit"
import { ConflictError, toErrorResponse } from "@/lib/api-errors"

export async function POST(request: Request) {
  try {
    const rateLimit = await checkAuthRateLimit(request)
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const { name, email, password } = parseRegisterInput(await request.json())

    // 检查用户是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      throw new ConflictError("User already exists")
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 12)

    // 创建用户
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
      }
    })
  } catch (error) {
    console.error("Register error:", error)
    return toErrorResponse(error)
  }
}
