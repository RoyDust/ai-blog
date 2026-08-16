import { NextResponse } from 'next/server'
import type { NextFetchEvent, NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { resolveAuthSecret } from '@/lib/auth-secret'
import { authSessionCookieName } from '@/lib/auth-cookies'
import { buildLoginPromptPath } from '@/lib/login-redirect'
import { resolveOperationLogIngestSecret } from '@/lib/api-operation-log-ingest-secret'
import { readBearerToken, resolveInternalSecret, safeSecretEquals } from '@/lib/internal-secrets'
import { checkInternalFailureRateLimit } from '@/lib/rate-limit'

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwardedFor || request.headers.get('x-real-ip') || null
}

function recordDeniedApi(
  request: NextRequest,
  event: NextFetchEvent | undefined,
  options: {
    scope: string
    operation: string
    statusCode: number
    errorMessage: string
    requestId: string
  },
) {
  if (!event) {
    return
  }

  // 生产缺配时返回 null 并在 lib 层发出一次 fail-loud 告警，这里跳过回写。
  const secret = resolveOperationLogIngestSecret()
  if (!secret) {
    return
  }

  const ingestUrl = new URL('/api/internal/operation-logs', request.url)
  event.waitUntil(
    fetch(ingestUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-operation-log-ingest-secret': secret,
      },
      body: JSON.stringify({
        requestId: options.requestId,
        method: request.method,
        path: request.nextUrl.pathname,
        query: request.nextUrl.search,
        scope: options.scope,
        operation: options.operation,
        statusCode: options.statusCode,
        errorMessage: options.errorMessage,
        ip: getClientIp(request),
        userAgent: request.headers.get('user-agent'),
      }),
    }).catch((error) => {
      console.error('Record denied API operation log error:', error)
    }),
  )
}

function jsonResponse(body: { error: string }, init: { status: number }, requestId: string) {
  const response = NextResponse.json(body, init)
  response.headers.set('x-request-id', requestId)
  return response
}

function adminApiJson(
  request: NextRequest,
  event: NextFetchEvent | undefined,
  body: { error: string },
  init: { status: number },
) {
  const requestId = crypto.randomUUID()
  recordDeniedApi(request, event, {
    scope: 'admin',
    operation: 'middleware.adminApiDenied',
    statusCode: init.status,
    errorMessage: body.error,
    requestId,
  })
  return jsonResponse(body, init, requestId)
}

function internalApiJson(
  request: NextRequest,
  event: NextFetchEvent | undefined,
  body: { error: string },
  init: { status: number },
  options: { record?: boolean; operation?: string } = {},
) {
  const requestId = crypto.randomUUID()

  if (options.record) {
    recordDeniedApi(request, event, {
      scope: 'cron',
      operation: options.operation ?? 'middleware.internalApiDenied',
      statusCode: init.status,
      errorMessage: body.error,
      requestId,
    })
  }

  return jsonResponse(body, init, requestId)
}

type InternalPathExpectation = {
  path: string
  /** 提取密钥的请求头；null 表示 Authorization: Bearer */
  header: string | null
  resolveSecret: () => string | null
}

/**
 * cron / internal 路径 → 期望密钥的注册表。
 * 新增内部路由必须在这里显式登记密钥来源，否则 middleware 直接 fail closed（503）。
 */
const INTERNAL_PATH_SECRETS: InternalPathExpectation[] = [
  {
    path: '/api/cron/ai-news',
    header: null,
    resolveSecret: () => resolveInternalSecret(['AI_NEWS_CRON_SECRET']),
  },
  {
    path: '/api/cron/publish-scheduled',
    header: null,
    resolveSecret: () =>
      resolveInternalSecret(['PUBLISH_SCHEDULED_CRON_SECRET', 'CRON_SECRET', 'AI_NEWS_CRON_SECRET']),
  },
  {
    path: '/api/internal/operation-logs',
    header: 'x-operation-log-ingest-secret',
    resolveSecret: () => resolveOperationLogIngestSecret(),
  },
]

function findInternalPathExpectation(pathname: string) {
  return INTERNAL_PATH_SECRETS.find((entry) => pathname === entry.path) ?? null
}

async function handleInternalApi(
  request: NextRequest,
  event: NextFetchEvent | undefined,
  pathname: string,
  isCron: boolean,
) {
  const expectation = findInternalPathExpectation(pathname)

  // 未登记的 cron/internal 前缀：fail closed。
  if (!expectation) {
    return internalApiJson(
      request,
      event,
      { error: 'Internal endpoint is not registered' },
      { status: 503 },
    )
  }

  const expectedSecret = expectation.resolveSecret()

  // cron 缺配一律 503（与 handler 语义一致）；internal 放行给 handler：
  // dev 有回退密钥；生产缺配时由 handler 返回 503。
  if (!expectedSecret) {
    if (isCron) {
      return internalApiJson(
        request,
        event,
        { error: 'Internal service secret is not configured' },
        { status: 503 },
      )
    }

    return NextResponse.next()
  }

  const provided = expectation.header
    ? (request.headers.get(expectation.header) ?? '').trim() || null
    : readBearerToken(request)

  if (!safeSecretEquals(provided, expectedSecret)) {
    // 失败限流：仅在密钥不匹配时计费，减缓 Bearer 爆破。
    const rateLimit = checkInternalFailureRateLimit(request)
    if (!rateLimit.allowed) {
      return internalApiJson(request, event, { error: 'Too many requests' }, { status: 429 })
    }

    // cron 拒绝写回操作日志；internal 拒绝不写回（防止与日志摄取形成自环）。
    return internalApiJson(
      request,
      event,
      { error: 'Unauthorized' },
      { status: 401 },
      { record: isCron, operation: 'middleware.cronApiDenied' },
    )
  }

  return NextResponse.next()
}

/**
 * 统一中间件入口：
 * - `/api/cron/*` 与 `/api/internal/*`：内部密钥网关兜底（handler 仍保留自检，双重防护）；
 * - `/admin/*` 与 `/api/admin/*`：NextAuth JWT + ADMIN 角色校验。
 */
export async function middleware(request: NextRequest, event?: NextFetchEvent) {
  const { pathname, search } = request.nextUrl
  const isCronApi = pathname.startsWith('/api/cron')
  const isInternalApi = pathname.startsWith('/api/internal')

  if (isCronApi || isInternalApi) {
    return handleInternalApi(request, event, pathname, isCronApi)
  }

  const isAdminPage = pathname.startsWith('/admin')
  const isAdminApi = pathname.startsWith('/api/admin')

  if (!isAdminPage && !isAdminApi) {
    return NextResponse.next()
  }

  const secret = resolveAuthSecret()
  if (!secret && process.env.NODE_ENV === 'production') {
    if (isAdminApi) {
      return adminApiJson(request, event, { error: 'Authentication secret is not configured' }, { status: 500 })
    }

    const loginUrl = new URL(
      buildLoginPromptPath({
        callbackUrl: `${pathname}${search}`,
        error: 'auth-secret-missing',
      }),
      request.url,
    )
    return NextResponse.redirect(loginUrl)
  }

  const token = await getToken({ req: request, secret, cookieName: authSessionCookieName })

  if (!token) {
    if (isAdminApi) {
      return adminApiJson(request, event, { error: 'Unauthorized' }, { status: 401 })
    }

    const loginUrl = new URL(buildLoginPromptPath({ callbackUrl: `${pathname}${search}` }), request.url)
    return NextResponse.redirect(loginUrl)
  }

  if (token.role !== 'ADMIN') {
    if (isAdminApi) {
      return adminApiJson(request, event, { error: 'Forbidden' }, { status: 403 })
    }

    const loginUrl = new URL(
      buildLoginPromptPath({
        callbackUrl: `${pathname}${search}`,
        error: 'not-admin',
      }),
      request.url,
    )
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  // middleware 需要 node:crypto（常量时间密钥比较）与共享限流器，
  // 显式声明 Node runtime（自托管部署无 Edge 诉求）。
  runtime: 'nodejs',
  matcher: ['/admin/:path*', '/api/admin/:path*', '/api/cron/:path*', '/api/internal/:path*'],
}
