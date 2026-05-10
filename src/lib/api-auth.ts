import { getServerSession } from "next-auth"
import type { DefaultSession } from "next-auth"

import { authOptions } from "@/lib/auth"
import { ForbiddenError, UnauthorizedError } from "@/lib/api-errors"
import { setApiOperationActor } from "@/lib/api-operation-log-context"

type RouteSessionUser = NonNullable<DefaultSession["user"]> & {
  id: string
  role: string
}

/**
 * API 路由层统一使用的精简会话类型。
 * 这里约束 user.id 与 user.role 一定存在，避免每个 route 反复做空值判断。
 */
export type RouteSession = {
  user: RouteSessionUser
  expires: string
}

/**
 * 要求请求必须已登录。
 *
 * 用途：
 * - 需要用户身份的 API 路由
 * - 后续还要根据 user.id 做资源归属判断的场景
 */
export async function requireSession(): Promise<RouteSession> {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    throw new UnauthorizedError()
  }

  const routeSession = session as RouteSession
  setApiOperationActor({
    actorType: routeSession.user.role === "ADMIN" ? "admin" : "user",
    actorUserId: routeSession.user.id,
    actorLabel: routeSession.user.email ?? routeSession.user.name ?? null,
  })

  return routeSession
}

/**
 * 要求请求必须是管理员。
 *
 * 这个方法建立在 requireSession 之上，先保证登录，再检查角色字段。
 */
export async function requireAdminSession(): Promise<RouteSession> {
  const session = await requireSession()

  if (session.user.role !== "ADMIN") {
    throw new ForbiddenError()
  }

  return session
}

/**
 * 判断当前会话是否具备发布权限。
 * 目前只有 ADMIN 可以直接控制文章发布状态。
 */
export function canPublish(session: Pick<RouteSession, "user">) {
  return session.user.role === "ADMIN"
}
