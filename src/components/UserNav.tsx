'use client'

import { signOut, useSession } from 'next-auth/react'
import Link from 'next/link'

function clearAllSessionData() {
  if (typeof window === 'undefined') return

  // Clear localStorage
  localStorage.clear()

  // Clear all cookies - try all possible session cookie names
  const cookieNames = [
    'next-auth.session-token',
    'next-auth.callback-url',
    '__next-auth_basic_session',
    '__Secure-next-auth.session-token',
    'next-auth.pkce.code_verifier',
    'next-auth.verifier'
  ]

  cookieNames.forEach(name => {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=localhost;`
  })

  // Clear ALL cookies on the domain
  try {
    const cookies = document.cookie.split(';')
    cookies.forEach(cookie => {
      const name = cookie.split('=')[0].trim()
      if (name && name.includes('next')) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`
      }
    })
  } catch (e) {
    console.error('Error clearing cookies:', e)
  }
}

export function UserNav() {
  const { data: session, status } = useSession()

  const handleLogout = async () => {
    // Clear session data first
    clearAllSessionData()

    // Call signOut with redirect: false, then manually redirect
    await signOut({
      callbackUrl: '/',
      redirect: false
    })

    // Force full page reload to clear all state
    window.location.href = '/'
  }

  if (status === 'loading') {
    return (
      <nav className="flex items-center gap-4">
        <span className="text-gray-500">鍔犺浇涓?..</span>
      </nav>
    )
  }

  if (session?.user) {
    return (
      <nav className="flex items-center gap-4">
        <Link href="/profile" className="text-gray-700 dark:text-gray-300 hover:text-blue-600">
          {session.user.name || session.user.email}
        </Link>
        <Link href="/bookmarks" className="text-gray-700 dark:text-gray-300 hover:text-blue-600">
          鏀惰棌
        </Link>
        <Link href="/admin/posts/new" className="text-gray-700 dark:text-gray-300 hover:text-blue-600">
          鍐欐枃绔?
        </Link>
        <Link href="/admin" className="text-gray-700 dark:text-gray-300 hover:text-blue-600">
          绠＄悊
        </Link>
        <button
          onClick={handleLogout}
          className="text-gray-700 dark:text-gray-300 hover:text-blue-600"
        >
          鐧诲嚭
        </button>
      </nav>
    )
  }

  return (
    <nav className="flex items-center gap-4">
      <Link href="/login" className="text-gray-700 dark:text-gray-300 hover:text-blue-600">
        鐧诲綍
      </Link>
      <Link href="/register" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
        娉ㄥ唽
      </Link>
    </nav>
  )
}

