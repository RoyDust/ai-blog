'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useSyncExternalStore } from 'react'
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

const DEFAULT_THEME: Theme = 'dark'
const THEME_STORAGE_KEY = 'theme'
const THEME_CHANGE_EVENT = 'inkforge-theme-change'

const ThemeContext = createContext<{
  theme: Theme
  toggleTheme: (origin?: ThemeTransitionOrigin) => void
}>({
  theme: DEFAULT_THEME,
  toggleTheme: () => {}
})

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
  localStorage.setItem(THEME_STORAGE_KEY, theme)
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return DEFAULT_THEME

  const saved = localStorage.getItem(THEME_STORAGE_KEY)

  return saved === 'light' || saved === 'dark' ? saved : DEFAULT_THEME
}

function getServerThemeSnapshot(): Theme {
  return DEFAULT_THEME
}

function subscribeToTheme(onStoreChange: () => void) {
  if (typeof window === 'undefined') return () => {}

  const handleStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) onStoreChange()
  }

  window.addEventListener('storage', handleStorage)
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange)

  return () => {
    window.removeEventListener('storage', handleStorage)
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange)
  }
}

function getTransitionRadius(origin: ThemeTransitionOrigin) {
  const farthestX = Math.max(origin.x, window.innerWidth - origin.x)
  const farthestY = Math.max(origin.y, window.innerHeight - origin.y)

  return Math.hypot(farthestX, farthestY)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribeToTheme, getStoredTheme, getServerThemeSnapshot)
  const hasAppliedInitialThemeRef = useRef(false)
  const isTransitioningRef = useRef(false)

  useEffect(() => {
    if (!hasAppliedInitialThemeRef.current) {
      hasAppliedInitialThemeRef.current = true
      applyTheme(getStoredTheme())
      return
    }

    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    const savedHue = localStorage.getItem("theme-hue") ?? "250";
    document.documentElement.style.setProperty("--hue", savedHue);
  }, []);

  const toggleTheme = useCallback((origin?: ThemeTransitionOrigin) => {
    const currentTheme = getStoredTheme()
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light'
    const transitionDocument = document as ViewTransitionDocument
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!origin || !transitionDocument.startViewTransition || prefersReducedMotion || isTransitioningRef.current) {
      applyTheme(nextTheme)
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
      flushSync(() => {
        applyTheme(nextTheme)
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
  }, [])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
