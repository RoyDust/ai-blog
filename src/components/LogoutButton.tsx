'use client'

import { signOut } from 'next-auth/react'

function clearAllSessionData() {
  if (typeof window === 'undefined') return

  // Clear localStorage completely
  localStorage.clear()

  // Clear all cookies
  const cookieNames = [
    'next-auth.session-token',
    'next-auth.callback-url',
    '__next-auth_basic_session',
    '__Secure-next-auth.session-token',
    'next-auth.pkce.code_verifier'
  ]

  cookieNames.forEach(name => {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`
  })

  // Clear ALL cookies
  try {
    const cookies = document.cookie.split(';')
    cookies.forEach(cookie => {
      const name = cookie.split('=')[0].trim()
      if (name) {
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`
      }
    })
  } catch (e) {
    console.error('Error clearing cookies:', e)
  }
}

export function LogoutButton() {
  const handleLogout = async () => {
    clearAllSessionData()

    await signOut({
      callbackUrl: '/',
      redirect: false
    })

    window.location.href = '/'
  }

  return (
    <button
      onClick={handleLogout}
      className="text-75 transition-colors hover:text-[var(--brand-strong)]"
    >
      登出
    </button>
  )
}
