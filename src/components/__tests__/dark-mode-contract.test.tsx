import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'

function readSource(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), 'utf8')
}

test('theme toggle uses semantic token-driven icon styling', () => {
  const source = readSource('src/components/ThemeToggle.tsx')

  expect(source).toContain('text-current')
  expect(source).not.toMatch(/text-gray-\d+/)
  expect(source).not.toMatch(/dark:text-/)
})

test('post card uses semantic classes for dark-mode text and media', () => {
  const source = readSource('src/components/posts/PostCard.tsx')

  expect(source).toContain('theme-media')
  expect(source).toContain('theme-media-image')
  expect(source).toContain('text-90')
  expect(source).toContain('text-75')
  expect(source).not.toMatch(/text-gray-\d+/)
  expect(source).not.toMatch(/bg-blue-\d+/)
  expect(source).not.toMatch(/dark:text-/)
})

test('auth entry points stop depending on hand-authored gray and blue theme pairs', () => {
  const loginSource = readSource('src/app/(auth)/login/page.tsx')
  const registerSource = readSource('src/app/(auth)/register/page.tsx')
  const authLayoutSource = readSource('src/app/(auth)/layout.tsx')
  const combined = `${loginSource}\n${registerSource}\n${authLayoutSource}`

  expect(combined).toContain('ui-alert-danger')
  expect(combined).toContain('ui-link')
  expect(combined).toContain('bg-background')
  expect(combined).not.toMatch(/text-gray-\d+/)
  expect(combined).not.toMatch(/bg-gray-\d+/)
  expect(combined).not.toMatch(/text-blue-\d+/)
  expect(combined).not.toMatch(/dark:text-/)
})

test('profile views use semantic surfaces instead of gray and blue theme pairs', () => {
  const profileSource = readSource('src/app/profile/page.tsx')
  const profileEditSource = readSource('src/app/profile/edit/page.tsx')
  const combined = `${profileSource}\n${profileEditSource}`

  expect(combined).toContain('bg-background')
  expect(combined).toContain('card-base')
  expect(combined).toContain('ui-alert-danger')
  expect(combined).not.toMatch(/bg-gray-\d+/)
  expect(combined).not.toMatch(/text-gray-\d+/)
  expect(combined).not.toMatch(/text-blue-\d+/)
  expect(combined).not.toMatch(/dark:text-/)
})

test('reading surfaces avoid hard-coded dark code blocks and rely on tokens', () => {
  const articleSource = readSource('src/app/(public)/posts/[slug]/page.tsx')
  const editorSource = readSource('src/components/posts/MarkdownEditor.tsx')
  const combined = `${articleSource}\n${editorSource}`

  expect(combined).toContain('prose-pre:bg-[var(--surface-elevated)]')
  expect(combined).toContain('prose-pre:text-[var(--foreground)]')
  expect(combined).not.toContain('prose-pre:bg-[#0b1220]')
  expect(combined).not.toContain('prose-pre:text-slate-100')
})
