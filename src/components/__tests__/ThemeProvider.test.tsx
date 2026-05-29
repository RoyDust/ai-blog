import { render, screen, waitFor } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, test } from 'vitest'

import { ThemeProvider, useTheme } from '../ThemeProvider'

function ThemeProbe() {
  const { theme } = useTheme()

  return <div data-testid="theme-probe" data-theme={theme} />
}

afterEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('dark')
  document.documentElement.style.colorScheme = ''
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
})
