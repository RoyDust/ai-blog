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

test('retired profile routes redirect into admin instead of rendering a separate surface', () => {
  const profileSource = readSource('src/app/profile/page.tsx')
  const profileEditSource = readSource('src/app/profile/edit/page.tsx')
  const combined = `${profileSource}\n${profileEditSource}`

  expect(combined).toContain("redirect('/admin')")
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

test('night reader theme exposes reusable tokens and semantic classes', () => {
  const themeSource = readSource('src/styles/theme-variables.css')
  const componentSource = readSource('src/styles/components.css')

  expect(themeSource).toContain('--reader-nav-height')
  expect(themeSource).toContain('--reader-banner-height')
  expect(themeSource).toContain('--reader-panel')
  expect(themeSource).toContain('--accent-warm')
  expect(themeSource).toContain('--accent-cyan')
  expect(themeSource).toContain('--reader-shadow')
  expect(themeSource).toContain('.admin-theme')

  expect(componentSource).toContain('.reader-shell')
  expect(componentSource).toContain('.reader-banner')
  expect(componentSource).toContain('.reader-nav')
  expect(componentSource).toContain('.reader-panel')
  expect(componentSource).toContain('.reader-feed-card')
  expect(componentSource).toContain('.reader-feature-card')
  expect(componentSource).toContain('.reader-chip')
  expect(componentSource).toContain('.reader-icon-btn')
})

test('global scrollbars stay thin and transparent across surfaces', () => {
  const source = readSource('src/app/globals.css')

  expect(source).toContain('scrollbar-color: rgb(148 163 184 / 0.22) transparent')
  expect(source).toContain('scrollbar-width: thin')
  expect(source).toContain('width: 4px')
  expect(source).toContain('height: 4px')
  expect(source).toContain('background: transparent')
  expect(source).toContain('background-color: rgb(148 163 184 / 0.22)')
})
