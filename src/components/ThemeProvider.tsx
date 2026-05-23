'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'

type Theme = 'light' | 'dark'
type ThemeTransitionOrigin = {
  x: number
  y: number
}

type BrowserViewTransition = {
  finished: Promise<void>
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => BrowserViewTransition
}

const ThemeContext = createContext<{
  theme: Theme
  toggleTheme: (origin?: ThemeTransitionOrigin) => void
}>({
  theme: 'light',
  toggleTheme: () => {}
})

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
  localStorage.setItem('theme', theme)
}

function getTransitionRadius(origin: ThemeTransitionOrigin) {
  const farthestX = Math.max(origin.x, window.innerWidth - origin.x)
  const farthestY = Math.max(origin.y, window.innerHeight - origin.y)

  return Math.hypot(farthestX, farthestY)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'dark'

    const saved = localStorage.getItem('theme')
    if (saved === 'light' || saved === 'dark') return saved

    return 'dark'
  })
  const isTransitioningRef = useRef(false)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    const savedHue = localStorage.getItem("theme-hue") ?? "250";
    document.documentElement.style.setProperty("--hue", savedHue);
  }, []);

  const toggleTheme = useCallback((origin?: ThemeTransitionOrigin) => {
    const nextTheme = theme === 'light' ? 'dark' : 'light'
    const transitionDocument = document as ViewTransitionDocument
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!origin || !transitionDocument.startViewTransition || prefersReducedMotion || isTransitioningRef.current) {
      applyTheme(nextTheme)
      setTheme(nextTheme)
      return
    }

    const root = document.documentElement
    const radius = getTransitionRadius(origin)

    isTransitioningRef.current = true
    root.style.setProperty('--theme-transition-x', `${origin.x}px`)
    root.style.setProperty('--theme-transition-y', `${origin.y}px`)
    root.style.setProperty('--theme-transition-radius', `${radius}px`)
    root.classList.add('theme-transitioning')

    const transition = transitionDocument.startViewTransition(() => {
      applyTheme(nextTheme)
      flushSync(() => {
        setTheme(nextTheme)
      })
    })

    void transition.finished.then(
      () => {
        isTransitioningRef.current = false
        root.classList.remove('theme-transitioning')
      },
      () => {
        isTransitioningRef.current = false
        root.classList.remove('theme-transitioning')
      },
    )
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
