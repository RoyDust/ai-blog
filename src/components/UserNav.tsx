'use client'

import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'

function clearAllSessionData() {
  if (typeof window === 'undefined') return

  localStorage.clear()

  const cookieNames = [
    'next-auth.session-token',
    'next-auth.callback-url',
    '__next-auth_basic_session',
    '__Secure-next-auth.session-token',
    'next-auth.pkce.code_verifier',
    'next-auth.verifier',
  ]

  cookieNames.forEach((name) => {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=localhost;`
  })

  try {
    const cookies = document.cookie.split(';')
    cookies.forEach((cookie) => {
      const name = cookie.split('=')[0].trim()
      if (name && name.includes('next')) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`
      }
    })
  } catch (error) {
    console.error('Error clearing cookies:', error)
  }
}

const navLinkClass = 'text-75 transition-colors hover:text-[var(--brand-strong)]'

export function UserNav() {
  const { data: session, status } = useSession()

  const handleLogout = async () => {
    clearAllSessionData()

    await signOut({
      callbackUrl: '/',
      redirect: false,
    })

    window.location.href = '/'
  }

  if (status === 'loading') {
    return (
      <nav className="flex items-center gap-4">
        <span className="text-50">加载中...</span>
      </nav>
    )
  }

  if (session?.user) {
    return (
      <nav className="flex items-center gap-4">
        <Link href="/admin" className={navLinkClass}>
          {session.user.name || session.user.email}
        </Link>
        <Link href="/bookmarks" className={navLinkClass}>
          我的收藏
        </Link>
        <Link href="/admin/posts/new" className={navLinkClass}>
          写文章
        </Link>
        <Link href="/admin" className={navLinkClass}>
          控制台
        </Link>
        <button onClick={handleLogout} className={navLinkClass}>
          退出
        </button>
      </nav>
    )
  }

  return (
    <nav className="flex items-center gap-4">
      <Link href="/login" className={navLinkClass}>
        登录
      </Link>
      <Link
        href="/register"
        className="ui-btn inline-flex items-center rounded-lg bg-[var(--brand)] px-4 py-2 text-white transition hover:bg-[var(--brand-strong)]"
      >
        注册
      </Link>
    </nav>
  )
}
