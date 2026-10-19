import crypto from "node:crypto"

import { ValidationError } from "@/lib/api-errors"
import { getBrowserIdFromHeaders, maskIpAddress } from "@/lib/browser-id"

export type AnonymousActor = {
  browserId: string
  actorId: string
  authorLabel: string
}

function getClientIp(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const realIp = headers.get("x-real-ip")?.trim()

  return forwardedFor || realIp || "anonymous"
}

function getActorSecret() {
  return process.env.ANONYMOUS_ACTOR_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "local-dev-anonymous-actor"
}

/**
 * 从请求头解析匿名访客身份；缺少合法 browserId 时返回 null。
 *
 * actorId 只对 browserId 做 HMAC，不混入 IP：同一浏览器切换网络后身份保持不变。
 * IP 仅用于限流与评论展示用的脱敏标签。
 */
export function resolveAnonymousActor(headers: Headers): AnonymousActor | null {
  const browserId = getBrowserIdFromHeaders(headers)

  if (!browserId) {
    return null
  }

  const actorId = crypto.createHmac("sha256", getActorSecret()).update(browserId).digest("hex")

  return {
    browserId,
    actorId: `anon_${actorId}`,
    authorLabel: maskIpAddress(getClientIp(headers)),
  }
}

export function createAnonymousActorId(headers: Headers): AnonymousActor {
  const actor = resolveAnonymousActor(headers)

  if (!actor) {
    throw new ValidationError("Valid browser ID is required")
  }

  return actor
}
