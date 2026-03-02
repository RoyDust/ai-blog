import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { Button } from '@/components/ui/Button'

test('button uses tokenized class contract', () => {
  const { getByRole } = render(<Button>Go</Button>)
  expect(getByRole('button').className).toContain('ui-btn')
})
