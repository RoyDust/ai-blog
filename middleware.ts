import { NextResponse } from 'next/server'

/**
 * 预留统一中间件入口，后续可在这里收敛边缘侧安全策略。
 */
export function middleware() {
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
