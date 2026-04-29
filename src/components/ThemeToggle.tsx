'use client'

import { Moon, Sun } from 'lucide-react'

import { useTheme } from './ThemeProvider'

export function ThemeToggle() {
  const { toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      className="reader-icon-btn scale-animation text-current hover:text-[var(--accent-warm)]"
      aria-label="切换主题"
      title="切换主题"
      type="button"
    >
      <Moon className="h-5 w-5 text-current dark:hidden" />
      <Sun className="hidden h-5 w-5 text-current dark:block" />
    </button>
  )
}
