import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

describe('ui primitives', () => {
  test('button supports variants with consistent focus ring', () => {
    render(<Button variant="primary">Save</Button>)
    expect(screen.getByRole('button').className).toContain('focus-visible')
  })

  test('input renders error text when provided', () => {
    render(<Input label="Email" error="Required" />)
    expect(screen.getByText('Required')).toBeInTheDocument()
  })
})
