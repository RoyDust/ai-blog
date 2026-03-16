import { getServerSession } from "next-auth"
import type { DefaultSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { ForbiddenError, UnauthorizedError } from "@/lib/api-errors"

type RouteSessionUser = NonNullable<DefaultSession["user"]> & {
  id: string
  role: string
}

export type RouteSession = {
  user: RouteSessionUser
  expires: string
}

export async function requireSession(): Promise<RouteSession> {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    throw new UnauthorizedError()
  }

  return session as RouteSession
}

export async function requireAdminSession(): Promise<RouteSession> {
  const session = await requireSession()

  if (session.user.role !== "ADMIN") {
    throw new ForbiddenError()
  }

  return session
}

export function canPublish(session: Pick<RouteSession, "user">) {
  return session.user.role === "ADMIN"
}
