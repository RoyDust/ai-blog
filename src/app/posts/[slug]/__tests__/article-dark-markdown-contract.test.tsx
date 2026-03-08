import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'

function readSource(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), 'utf8')
}

test('article markdown prose uses semantic dark-mode tokens', () => {
  const source = readSource('src/app/(public)/posts/[slug]/page.tsx')

  expect(source).toContain('prose-pre:bg-[var(--surface-elevated)]')
  expect(source).toContain('prose-pre:text-[var(--foreground)]')
  expect(source).toContain('prose-blockquote:border-[var(--border-strong)]')
  expect(source).toContain('prose-blockquote:text-[var(--text-body)]')
  expect(source).toContain('prose-strong:text-[var(--foreground)]')
  expect(source).toContain('prose-li:marker:text-[var(--text-faint)]')
})

test('article markdown headings h1 through h5 use semantic heading colors', () => {
  const source = readSource('src/app/(public)/posts/[slug]/page.tsx')

  expect(source).toContain('prose-headings:text-[var(--foreground)]')
  expect(source).toContain('prose-h1:text-[var(--foreground)]')
  expect(source).toContain('prose-h2:text-[var(--foreground)]')
  expect(source).toContain('prose-h3:text-[var(--foreground)]')
  expect(source).toContain('prose-h4:text-[var(--foreground)]')
  expect(source).toContain('prose-h5:text-[var(--foreground)]')
  expect(source).toContain('prose-h6:text-[var(--foreground)]')
})

test('article markdown polish covers h6, table headers, quote rail and inline code contrast', () => {
  const source = readSource('src/app/(public)/posts/[slug]/page.tsx')

  expect(source).toContain('prose-h6:text-[var(--foreground)]')
  expect(source).toContain('prose-th:text-[var(--foreground)]')
  expect(source).toContain('prose-th:bg-[var(--surface-contrast)]')
  expect(source).toContain('prose-blockquote:border-l-[3px]')
  expect(source).toContain('prose-code:bg-[color-mix(in_oklab,var(--surface-contrast)_82%,black_18%)]')
  expect(source).toContain('prose-code:text-[color-mix(in_oklab,var(--foreground)_92%,white_8%)]')
})

test('highlight styles avoid hard-coded dark slate colors', () => {
  const source = readSource('src/styles/code-highlight.css')

  expect(source).toContain('#0b1220')
  expect(source).toContain('#e5eef9')
  expect(source).toContain('var(--text-muted)')
})

test('code highlight keeps dark blocks even in light mode', () => {
  const source = readSource('src/styles/code-highlight.css')

  expect(source).toContain('background: #0b1220')
  expect(source).toContain('color: #e5eef9')
})

test('fenced code blocks reset inline code chip background', () => {
  const source = readSource('src/styles/code-highlight.css')

  expect(source).toContain('.prose pre code')
  expect(source).toContain('background: transparent')
  expect(source).toContain('padding: 0')
  expect(source).toContain('border-radius: 0')
})

test('markdown article images do not use a gray backing wrapper', () => {
  const source = readSource('src/app/(public)/posts/[slug]/page.tsx')

  expect(source).toContain('img: ({ src, alt }) =>')
  expect(source).not.toContain('className="theme-media my-8 block overflow-hidden rounded-xl"')
  expect(source).toContain('className="my-8 block overflow-hidden rounded-xl"')
})
