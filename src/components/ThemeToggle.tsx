'use client'

import type { MouseEvent } from 'react'
import { Moon, Sun } from 'lucide-react'

import { useTheme } from './ThemeProvider'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  const handleToggle = (event: MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()

    toggleTheme({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    })
  }

  return (
    <button
      onClick={handleToggle}
      className="reader-icon-btn theme-toggle-btn text-current hover:text-[var(--accent-warm)]"
      data-theme={theme}
      aria-label={theme === 'dark' ? '切换到日间主题' : '切换到夜间主题'}
      title={theme === 'dark' ? '切换到日间主题' : '切换到夜间主题'}
      type="button"
    >
      <span className="theme-toggle-icon-stack" aria-hidden="true">
        <Moon className="theme-toggle-icon theme-toggle-icon--moon h-5 w-5 text-current" />
        <Sun className="theme-toggle-icon theme-toggle-icon--sun h-5 w-5 text-current" />
      </span>
    </button>
  )
}
