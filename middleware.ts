import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { resolveAuthSecret } from '@/lib/auth-secret'

/**
 * 棰勭暀缁熶竴涓棿浠跺叆鍙ｏ紝鍚庣画鍙湪杩欓噷鏀舵暃杈圭紭渚у畨鍏ㄧ瓥鐣ャ€? */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const isAdminPage = pathname.startsWith('/admin')
  const isAdminApi = pathname.startsWith('/api/admin')

  if (!isAdminPage && !isAdminApi) {
    return NextResponse.next()
  }

  const secret = resolveAuthSecret()
  if (!secret && process.env.NODE_ENV === 'production') {
    if (isAdminApi) {
      return NextResponse.json({ error: 'Authentication secret is not configured' }, { status: 500 })
    }

    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('error', 'auth-secret-missing')
    loginUrl.searchParams.set('callbackUrl', `${pathname}${search}`)
    return NextResponse.redirect(loginUrl)
  }

  const token = await getToken({ req: request, secret })

  if (!token) {
    if (isAdminApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', `${pathname}${search}`)
    return NextResponse.redirect(loginUrl)
  }

  if (token.role !== 'ADMIN') {
    if (isAdminApi) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('error', 'not-admin')
    loginUrl.searchParams.set('callbackUrl', `${pathname}${search}`)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
}

