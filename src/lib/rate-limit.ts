type HitWindow = {
  count: number
  resetAt: number
}

type RateLimitResult = {
  allowed: boolean
  remaining: number
  resetAt?: number
  strategy?: "memory" | "database"
}

/**
 * 创建一个轻量的内存限流器，适合当前单实例、低流量场景。
 */
export function createMemoryRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  const store = new Map<string, HitWindow>()

  return {
    check(key: string): RateLimitResult {
      const now = Date.now()
      const current = store.get(key)

      if (!current || current.resetAt <= now) {
        store.set(key, { count: 1, resetAt: now + windowMs })
        return { allowed: true, remaining: limit - 1, resetAt: now + windowMs, strategy: "memory" }
      }

      if (current.count >= limit) {
        return { allowed: false, remaining: 0, resetAt: current.resetAt, strategy: "memory" }
      }

      current.count += 1
      return { allowed: true, remaining: limit - current.count, resetAt: current.resetAt, strategy: "memory" }
    },
  }
}

const authLimiter = createMemoryRateLimiter({ limit: 5, windowMs: 60_000 })
const searchLimiter = createMemoryRateLimiter({ limit: 60, windowMs: 60_000 })
const aiSearchLimiter = createMemoryRateLimiter({ limit: 8, windowMs: 60_000 })
const interactionLimiter = createMemoryRateLimiter({ limit: 20, windowMs: 60_000 })
const uploadLimiter = createMemoryRateLimiter({ limit: 10, windowMs: 60_000 })
let rateLimitTableReady = false

async function ensureRateLimitTable() {
  if (rateLimitTableReady || process.env.NODE_ENV === "test") {
    return
  }

  const { prisma } = await import("@/lib/prisma")

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS rate_limit_entries (
      key TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      reset_at TIMESTAMPTZ NOT NULL
    )
  `)

  rateLimitTableReady = true
}

async function checkDatabaseRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const { prisma } = await import("@/lib/prisma")

  await ensureRateLimitTable()

  const rows = await prisma.$queryRawUnsafe<Array<{ count: number; reset_at: Date }>>(
    `
      INSERT INTO rate_limit_entries AS entries (key, count, reset_at)
      VALUES ($1, 1, NOW() + ($2 * INTERVAL '1 millisecond'))
      ON CONFLICT (key) DO UPDATE
      SET count = CASE
          WHEN entries.reset_at <= NOW() THEN 1
          ELSE entries.count + 1
        END,
        reset_at = CASE
          WHEN entries.reset_at <= NOW() THEN NOW() + ($2 * INTERVAL '1 millisecond')
          ELSE entries.reset_at
        END
      RETURNING count, reset_at
    `,
    key,
    windowMs,
  )

  const current = rows[0]
  const remaining = Math.max(limit - current.count, 0)

  return {
    allowed: current.count <= limit,
    remaining,
    resetAt: new Date(current.reset_at).getTime(),
    strategy: "database",
  }
}

function resolveRateLimitMode() {
  const configured = process.env.RATE_LIMIT_DRIVER

  if (configured === "database" || configured === "memory") {
    return configured
  }

  return process.env.NODE_ENV === "production" ? "database" : "memory"
}

async function checkRateLimit(request: Request, scope: string, options: { limit: number; windowMs: number }) {
  const key = getRateLimitKey(request, scope)

  if (resolveRateLimitMode() === "database") {
    return checkDatabaseRateLimit(key, options.limit, options.windowMs)
  }

  if (scope === "auth") {
    return authLimiter.check(key)
  }

  if (scope === "search") {
    return searchLimiter.check(key)
  }

  if (scope === "ai-search") {
    return aiSearchLimiter.check(key)
  }

  if (scope === "upload") {
    return uploadLimiter.check(key)
  }

  return interactionLimiter.check(key)
}

/**
 * 基于请求元数据生成带作用域的稳定限流键。
 */
export function getRateLimitKey(request: Request, scope: string) {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')?.trim()
  const ip = forwardedFor?.split(',')[0]?.trim() || realIp || 'anonymous'

  return `${scope}:${ip}`
}

/**
 * 对认证相关接口应用更严格的限流策略。
 */
export function checkAuthRateLimit(request: Request) {
  return checkRateLimit(request, 'auth', { limit: 5, windowMs: 60_000 })
}

/**
 * 对公开站内搜索应用宽松限流，保护数据库查询路径。
 */
export function checkSearchRateLimit(request: Request) {
  return checkRateLimit(request, 'search', { limit: 60, windowMs: 60_000 })
}

/**
 * 对 AI 搜索摘要应用更严格的限流，避免公开入口消耗过快。
 */
export function checkAiSearchRateLimit(request: Request) {
  return checkRateLimit(request, 'ai-search', { limit: 8, windowMs: 60_000 })
}

/**
 * 对点赞、收藏、评论等读者交互接口应用中等强度限流。
 */
export function checkInteractionRateLimit(request: Request) {
  return checkRateLimit(request, 'interaction', { limit: 20, windowMs: 60_000 })
}

/**
 * 对上传 token 签发接口应用更紧的限流策略。
 */
export function checkUploadRateLimit(request: Request) {
  return checkRateLimit(request, 'upload', { limit: 10, windowMs: 60_000 })
}
