import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, test, vi } from 'vitest'

import { ThemeProvider, useTheme } from '../ThemeProvider'

const themeChangeListener = vi.fn()

function ThemeProbe() {
  const { theme } = useTheme()

  return <div data-testid="theme-probe" data-theme={theme} />
}

function ThemeToggleProbe() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button data-theme={theme} onClick={() => toggleTheme()} type="button">
      toggle
    </button>
  )
}

function mockMotionPreference(reducedMotion: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: reducedMotion && query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

function mockViewTransition() {
  let resolveFinished = () => {}
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve
  })
  const startViewTransition = vi.fn((callback: () => void) => {
    callback()
    return { finished }
  })

  Object.defineProperty(document, 'startViewTransition', {
    configurable: true,
    value: startViewTransition,
  })

  return { finished, resolveFinished, startViewTransition }
}

afterEach(() => {
  window.removeEventListener('inkforge-theme-change', themeChangeListener)
  localStorage.clear()
  document.documentElement.classList.remove('dark')
  document.documentElement.classList.remove('theme-transitioning')
  document.documentElement.style.colorScheme = ''
  Reflect.deleteProperty(document, 'startViewTransition')
  mockMotionPreference(false)
})

describe('ThemeProvider', () => {
  test('keeps the first render deterministic when a saved theme exists', () => {
    localStorage.setItem('theme', 'light')

    const html = renderToString(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    expect(html).toContain('data-theme="dark"')
    expect(html).not.toContain('data-theme="light"')
  })

  test('applies the saved theme after mount', async () => {
    localStorage.setItem('theme', 'light')

    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('theme-probe')).toHaveAttribute('data-theme', 'light')
    })
    expect(document.documentElement).not.toHaveClass('dark')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  test('uses one scoped view transition for a theme change', async () => {
    localStorage.setItem('theme', 'dark')
    mockMotionPreference(false)
    const { finished, resolveFinished, startViewTransition } = mockViewTransition()
    window.addEventListener('inkforge-theme-change', themeChangeListener)

    render(
      <ThemeProvider>
        <ThemeToggleProbe />
      </ThemeProvider>,
    )
    themeChangeListener.mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }))

    expect(startViewTransition).toHaveBeenCalledTimes(1)
    expect(document.documentElement).toHaveClass('theme-transitioning')
    expect(document.documentElement).not.toHaveClass('dark')
    expect(document.documentElement.style.colorScheme).toBe('light')
    expect(localStorage.getItem('theme')).toBe('light')
    expect(themeChangeListener).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveFinished()
      await finished
    })

    expect(document.documentElement).not.toHaveClass('theme-transitioning')
  })

  test('applies the theme immediately when reduced motion is requested', () => {
    localStorage.setItem('theme', 'dark')
    mockMotionPreference(true)
    const { startViewTransition } = mockViewTransition()

    render(
      <ThemeProvider>
        <ThemeToggleProbe />
      </ThemeProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }))

    expect(startViewTransition).not.toHaveBeenCalled()
    expect(document.documentElement).not.toHaveClass('theme-transitioning')
    expect(localStorage.getItem('theme')).toBe('light')
  })

  test('applies the theme immediately when View Transition is unavailable', () => {
    localStorage.setItem('theme', 'dark')
    mockMotionPreference(false)

    render(
      <ThemeProvider>
        <ThemeToggleProbe />
      </ThemeProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'toggle' }))

    expect(document.documentElement).not.toHaveClass('theme-transitioning')
    expect(localStorage.getItem('theme')).toBe('light')
  })

  test('ignores repeated toggles until the active transition finishes', () => {
    localStorage.setItem('theme', 'dark')
    mockMotionPreference(false)
    const { startViewTransition } = mockViewTransition()

    render(
      <ThemeProvider>
        <ThemeToggleProbe />
      </ThemeProvider>,
    )

    const toggle = screen.getByRole('button', { name: 'toggle' })
    fireEvent.click(toggle)
    fireEvent.click(toggle)

    expect(startViewTransition).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('theme')).toBe('light')
  })
})
