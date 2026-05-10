import { NextResponse } from 'next/server'
import type { NextFetchEvent, NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { resolveAuthSecret } from '@/lib/auth-secret'
import { authSessionCookieName } from '@/lib/auth-cookies'
import { buildLoginPromptPath } from '@/lib/login-redirect'
import { resolveOperationLogIngestSecret } from '@/lib/api-operation-log-ingest-secret'

function getClientIp(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwardedFor || request.headers.get('x-real-ip') || null
}

function recordDeniedAdminApi(request: NextRequest, event: NextFetchEvent | undefined, statusCode: number, errorMessage: string, requestId: string) {
  if (!event) {
    return
  }

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
        requestId,
        method: request.method,
        path: request.nextUrl.pathname,
        query: request.nextUrl.search,
        scope: 'admin',
        operation: 'middleware.adminApiDenied',
        statusCode,
        errorMessage,
        ip: getClientIp(request),
        userAgent: request.headers.get('user-agent'),
      }),
    }).catch((error) => {
      console.error('Record denied admin API operation log error:', error)
    }),
  )
}

function adminApiJson(
  request: NextRequest,
  event: NextFetchEvent | undefined,
  body: { error: string },
  init: { status: number },
) {
  const requestId = crypto.randomUUID()
  recordDeniedAdminApi(request, event, init.status, body.error, requestId)
  const response = NextResponse.json(body, init)
  response.headers.set('x-request-id', requestId)
  return response
}

/**
 * 棰勭暀缁熶竴涓棿浠跺叆鍙ｏ紝鍚庣画鍙湪杩欓噷鏀舵暃杈圭紭渚у畨鍏ㄧ瓥鐣ャ€? */
export async function middleware(request: NextRequest, event?: NextFetchEvent) {
  const { pathname, search } = request.nextUrl
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
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}
