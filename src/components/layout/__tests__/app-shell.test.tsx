import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { AppShell } from '@/components/layout/AppShell'

describe('app shell', () => {
  test('app shell renders role-aware navigation landmarks', () => {
    render(
      <AppShell>
        <div>Content</div>
      </AppShell>
    )

    expect(screen.getByRole('navigation')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '跳到主要内容' })).toHaveAttribute('href', '#main-content')
  })
})
