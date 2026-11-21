import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { Button } from '@/components/ui/Button'

test('button variants map onto the editorial button tiers', () => {
  const { getByRole, rerender } = render(<Button>Go</Button>)
  expect(getByRole('button')).toHaveClass('ed-btn')

  rerender(<Button variant="outline">Go</Button>)
  expect(getByRole('button')).toHaveClass('ed-btn-outline')

  rerender(<Button variant="secondary">Go</Button>)
  expect(getByRole('button')).toHaveClass('ed-btn-outline')

  rerender(<Button variant="danger" size="sm">Go</Button>)
  expect(getByRole('button')).toHaveClass('ed-btn-danger', 'ed-btn--sm')
})
