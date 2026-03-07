import { render } from '@testing-library/react'
import { expect, test } from 'vitest'
import { SearchForm } from '../SearchForm'

test('renders a GET search form targeting the search page', () => {
  const { getByRole } = render(<SearchForm />)

  const form = document.querySelector('form')
  const input = getByRole('searchbox', { name: '搜索文章' })
  const button = getByRole('button', { name: '搜索' })

  expect(form).not.toBeNull()
  expect(form?.getAttribute('method')).toBe('get')
  expect(form?.getAttribute('action')).toBe('/search')
  expect(input.getAttribute('name')).toBe('q')
  expect(button).toBeInTheDocument()
})
