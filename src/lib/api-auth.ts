import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { ForbiddenError, UnauthorizedError } from "@/lib/api-errors"

export type RouteSession = NonNullable<Awaited<ReturnType<typeof getServerSession>>>

export async function requireSession() {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    throw new UnauthorizedError()
  }

  return session as RouteSession
}

export async function requireAdminSession() {
  const session = await requireSession()

  if (session.user.role !== "ADMIN") {
    throw new ForbiddenError()
  }

  return session
}

export function canPublish(session: Pick<RouteSession, "user">) {
  return session.user.role === "ADMIN"
}
