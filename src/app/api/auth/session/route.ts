import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { toErrorResponse } from "@/lib/api-errors"
import { NextResponse } from "next/server"

async function GETHandler() {
  try {
    const session = await getServerSession(authOptions)
    return NextResponse.json({ user: session?.user })
  } catch (error) {
    return toErrorResponse(error)
  }
}

export const GET = withApiOperationLogging(GETHandler, { scope: 'auth', operation: 'auth.session.read', route: '/api/auth/session' });
