import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { SearchForm } from '../SearchForm'

test('renders a GET search form targeting the search page', () => {
  const { container } = render(<SearchForm />)

  const form = container.querySelector('form')
  const input = container.querySelector('input[type="search"][name="q"]')
  const button = screen.getByRole('button', { name: '搜索' })

  expect(form).not.toBeNull()
  expect(form?.getAttribute('method')).toBe('get')
  expect(form?.getAttribute('action')).toBe('/search')
  expect(input?.getAttribute('name')).toBe('q')
  expect(input).toHaveAttribute('aria-label', '搜索站内内容')
  expect(input).toHaveAttribute('placeholder', '搜索文章、标签或分类')
  expect(button).toBeInTheDocument()
  expect(button.className).toContain('bg-[var(--primary)]')
})

test('fills its navbar slot without breakpoint width steps and keeps native search semantics', () => {
  const { container } = render(<SearchForm compact appearance="navbar" />)

  const form = screen.getByRole('search')
  const input = within(form).getByRole('searchbox', { name: '搜索站内内容' })
  const inputWrapper = input.parentElement
  const button = container.querySelector('button[type="submit"]')

  expect(form?.getAttribute('method')).toBe('get')
  expect(form?.getAttribute('action')).toBe('/search')
  expect(input.getAttribute('type')).toBe('search')
  expect(form.className).toContain('w-full')
  expect(inputWrapper?.className).toContain('w-full')
  expect(input.className).toContain('w-full')
  expect(input.className).not.toMatch(/(?:^|\s)(?:lg|xl|2xl):w-[^\s]+/)
  expect(input.className).toContain('transition-[background-color,border-color,box-shadow]')
  expect(input.className).toContain('duration-200')
  expect(input.className).toContain('ease-out')
  expect(input.className).not.toMatch(/transition-\[[^\]]*(?:width|max-width)[^\]]*\]/)
  expect(button).toBeNull()
})
