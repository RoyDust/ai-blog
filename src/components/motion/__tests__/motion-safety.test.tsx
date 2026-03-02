import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { FadeIn } from '../FadeIn'

describe('motion safety', () => {
  test('motion components render static fallback when reduced motion is preferred', () => {
    render(
      <FadeIn reducedMotion>
        <div>static content</div>
      </FadeIn>
    )

    expect(screen.getByText('static content').parentElement).toHaveAttribute('data-motion', 'reduced')
  })
})
