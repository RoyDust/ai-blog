import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

describe('ui primitives', () => {
  test('primary button is the solid editorial button and leaves focus to the global ring', () => {
    render(<Button variant="primary">Save</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('ed-btn')
    expect(button.className).not.toContain('rounded-xl')
    expect(button.className).not.toContain('bg-[var(--primary)]')
  })

  test('input renders error text when provided', () => {
    render(<Input label="Email" error="Required" />)
    const message = screen.getByText('Required')
    expect(message).toHaveClass('ed-field-error')
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-describedby', message.id)
  })

  test('input follows the editorial form rules: label above, 44px outlined field, 16px on phones', () => {
    render(<Input label="Email" helperText="至少 8 位" requirement="required" />)

    const input = screen.getByLabelText(/Email/)
    expect(input).toHaveClass('ed-input', 'text-base', 'sm:text-[0.9375rem]')
    expect(input).toHaveAttribute('aria-required', 'true')
    expect(screen.getByText('*')).toHaveClass('ed-label__required')
    expect(screen.getByText('至少 8 位')).toHaveClass('ed-field-hint')
  })

  test('error replaces the helper text instead of stacking two lines', () => {
    render(<Input label="密码" helperText="至少 8 位" error="密码至少 8 位" />)

    expect(screen.queryByText('至少 8 位')).not.toBeInTheDocument()
    expect(screen.getByText('密码至少 8 位')).toHaveClass('ed-field-error')
  })

  test('optional fields read （可选） next to the label', () => {
    render(<Input label="姓名" requirement="optional" />)
    expect(screen.getByText('（可选）')).toHaveClass('ed-label__optional')
  })

  test('input supports a leading adornment without replacing label semantics', () => {
    render(<Input label="Email" leftSlot={<span data-testid="mail-icon" />} />)

    expect(screen.getByLabelText('Email')).toHaveClass('pl-11')
    expect(screen.getByTestId('mail-icon')).toBeInTheDocument()
  })
})
