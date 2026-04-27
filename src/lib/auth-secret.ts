const PLACEHOLDER_PATTERNS = [
  /replace[-_ ]?with/i,
  /placeholder/i,
  /change[-_ ]?me/i,
  /^your[-_ ]/i,
  /^<[^>]+>$/,
]

function normalizeSecret(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

export function isPlaceholderAuthSecret(value: unknown) {
  const secret = normalizeSecret(value)

  if (!secret) {
    return false
  }

  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(secret))
}

export function resolveAuthSecret(env: Pick<NodeJS.ProcessEnv, "NEXTAUTH_SECRET" | "AUTH_SECRET"> = process.env) {
  const nextAuthSecret = normalizeSecret(env.NEXTAUTH_SECRET)
  if (nextAuthSecret && !isPlaceholderAuthSecret(nextAuthSecret)) {
    return nextAuthSecret
  }

  const authSecret = normalizeSecret(env.AUTH_SECRET)
  if (authSecret && !isPlaceholderAuthSecret(authSecret)) {
    return authSecret
  }

  return undefined
}

export function requireAuthSecret(env: NodeJS.ProcessEnv = process.env) {
  const secret = resolveAuthSecret(env)

  if (!secret && env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET or NEXTAUTH_SECRET must be configured with a non-placeholder value")
  }

  return secret
}
