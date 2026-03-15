import crypto from "node:crypto"

import { ValidationError } from "@/lib/api-errors"
import { getBrowserIdFromHeaders, maskIpAddress } from "@/lib/browser-id"

function getClientIp(headers: Headers) {
  const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  const realIp = headers.get("x-real-ip")?.trim()

  return forwardedFor || realIp || "anonymous"
}

function getActorSecret() {
  return process.env.ANONYMOUS_ACTOR_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "local-dev-anonymous-actor"
}

export function createAnonymousActorId(headers: Headers) {
  const browserId = getBrowserIdFromHeaders(headers)

  if (!browserId) {
    throw new ValidationError("Valid browser ID is required")
  }

  const actorSource = `${browserId}:${getClientIp(headers)}`
  const actorId = crypto.createHmac("sha256", getActorSecret()).update(actorSource).digest("hex")

  return {
    browserId,
    actorId: `anon_${actorId}`,
    authorLabel: maskIpAddress(getClientIp(headers)),
  }
}
