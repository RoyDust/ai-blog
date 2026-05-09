import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { toErrorResponse } from "@/lib/api-errors"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    return NextResponse.json({ user: session?.user })
  } catch (error) {
    return toErrorResponse(error)
  }
}
