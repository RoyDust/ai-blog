'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'

type Theme = 'light' | 'dark'

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
  toggleTheme: () => void
}>({
  theme: DEFAULT_THEME,
  toggleTheme: () => {}
})

function applyTheme(theme: Theme) {
  const root = document.documentElement

  root.classList.toggle('dark', theme === 'dark')
  if (root.style.colorScheme !== theme) root.style.colorScheme = theme
  if (localStorage.getItem(THEME_STORAGE_KEY) === theme) return

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

  const toggleTheme = useCallback(() => {
    const currentTheme = getStoredTheme()
    const nextTheme = currentTheme === 'light' ? 'dark' : 'light'
    const transitionDocument = document as ViewTransitionDocument
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (isTransitioningRef.current) return

    if (!transitionDocument.startViewTransition || prefersReducedMotion) {
      applyTheme(nextTheme)
      return
    }

    const root = document.documentElement

    isTransitioningRef.current = true
    root.classList.add('theme-transitioning')

    let transition: BrowserViewTransition

    try {
      transition = transitionDocument.startViewTransition(() => {
        flushSync(() => {
          applyTheme(nextTheme)
        })
      })
    } catch {
      isTransitioningRef.current = false
      root.classList.remove('theme-transitioning')
      applyTheme(nextTheme)
      return
    }

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
