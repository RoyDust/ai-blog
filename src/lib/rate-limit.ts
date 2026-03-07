type HitWindow = {
  count: number
  resetAt: number
}

type RateLimitResult = {
  allowed: boolean
  remaining: number
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
        return { allowed: true, remaining: limit - 1 }
      }

      if (current.count >= limit) {
        return { allowed: false, remaining: 0 }
      }

      current.count += 1
      return { allowed: true, remaining: limit - current.count }
    },
  }
}

const authLimiter = createMemoryRateLimiter({ limit: 5, windowMs: 60_000 })
const interactionLimiter = createMemoryRateLimiter({ limit: 20, windowMs: 60_000 })
const uploadLimiter = createMemoryRateLimiter({ limit: 10, windowMs: 60_000 })

/**
 * 基于请求元数据生成带作用域的稳定限流键。
 */
export function getRateLimitKey(request: Request, scope: string) {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const ip = forwardedFor?.split(',')[0]?.trim() || 'anonymous'

  return `${scope}:${ip}`
}

/**
 * 对认证相关接口应用更严格的限流策略。
 */
export function checkAuthRateLimit(request: Request) {
  return authLimiter.check(getRateLimitKey(request, 'auth'))
}

/**
 * 对点赞、收藏、评论等读者交互接口应用中等强度限流。
 */
export function checkInteractionRateLimit(request: Request) {
  return interactionLimiter.check(getRateLimitKey(request, 'interaction'))
}

/**
 * 对上传 token 签发接口应用更紧的限流策略。
 */
export function checkUploadRateLimit(request: Request) {
  return uploadLimiter.check(getRateLimitKey(request, 'upload'))
}
