import { render, screen } from '@testing-library/react'
import { describe, expect, test, vi } from 'vitest'
import WritePage from '../page'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}))

describe('author workflow', () => {
  test('write page renders editor and publish settings panes', () => {
    render(<WritePage />)

    expect(screen.getByRole('heading', { name: '创作工作台' })).toBeInTheDocument()
    expect(screen.getByText('发布设置')).toBeInTheDocument()
  })
})
