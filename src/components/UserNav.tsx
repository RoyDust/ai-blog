'use client'

import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'

import { clearAllSessionData } from '@/lib/auth-client'
import { buildLoginPromptPath } from '@/lib/login-redirect'

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
      <Link href={buildLoginPromptPath()} className={navLinkClass}>
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
