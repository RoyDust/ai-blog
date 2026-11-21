import { render } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'

const sonnerProps = vi.hoisted(() => ({ value: null as Record<string, unknown> | null }))

vi.mock('sonner', () => ({
  Toaster: (props: Record<string, unknown>) => {
    sonnerProps.value = props
    return null
  },
}))

vi.mock('@/components/ThemeProvider', () => ({
  useTheme: () => ({ theme: 'dark' }),
}))

describe('Toaster', () => {
  test('keeps position and close button, drops rich colors and icons for the editorial toast', async () => {
    const { Toaster, editorialToastClassNames } = await import('../Toaster')
    render(<Toaster />)

    const props = sonnerProps.value!
    expect(props.position).toBe('top-right')
    expect(props.closeButton).toBe(true)
    expect(props.theme).toBe('dark')
    expect(props.richColors).toBeUndefined()
    expect(props.duration).toBeUndefined()
    expect(props.icons).toEqual({ success: null, error: null, info: null, warning: null })
    expect(props.style).toMatchObject({
      '--normal-bg': 'var(--card-bg)',
      '--normal-border': 'var(--reader-border-strong)',
      '--border-radius': 'var(--radius-ctl)',
    })

    // 左侧 2px 竖线：普通 foreground，失败 danger
    expect(editorialToastClassNames.toast).toContain('shadow-[inset_2px_0_0_var(--foreground)]')
    expect(editorialToastClassNames.toast).toContain('data-[type=error]:!shadow-[inset_2px_0_0_var(--danger-foreground)]')
  })
})
