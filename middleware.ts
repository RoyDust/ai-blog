import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

/**
 * 棰勭暀缁熶竴涓棿浠跺叆鍙ｏ紝鍚庣画鍙湪杩欓噷鏀舵暃杈圭紭渚у畨鍏ㄧ瓥鐣ャ€? */
export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (!pathname.startsWith('/admin')) {
    return NextResponse.next()
  }

  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET
  const token = await getToken({ req: request, secret })

  if (!token) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', `${pathname}${search}`)
    return NextResponse.redirect(loginUrl)
  }

  if (token.role !== 'ADMIN') {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('error', 'not-admin')
    loginUrl.searchParams.set('callbackUrl', `${pathname}${search}`)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}

