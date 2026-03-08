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

test('renders a navbar variant that expands on focus and submits with native search semantics', () => {
  const { container } = render(<SearchForm compact appearance="navbar" />)

  const form = container.querySelector('form')
  const input = within(form as HTMLFormElement).getByRole('searchbox', { name: '搜索站内内容' })
  const button = container.querySelector('button[type="submit"]')

  expect(form?.getAttribute('method')).toBe('get')
  expect(form?.getAttribute('action')).toBe('/search')
  expect(input.getAttribute('type')).toBe('search')
  expect(input.className).toContain('lg:w-40')
  expect(input.className).toContain('lg:focus:w-64')
  expect(button).toBeNull()
})
