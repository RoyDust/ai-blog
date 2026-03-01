import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function POST() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ success: true, message: "No active session" })
  }

  return NextResponse.json({ success: true })
}

export async function GET() {
  return NextResponse.redirect(new URL('/', process.env.NEXTAUTH_URL || 'http://localhost:3001'))
}
