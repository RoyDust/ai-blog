import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'

function readSource(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), 'utf8')
}

test('article markdown body uses the editorial prose layer instead of typography plugin overrides', () => {
  const source = readSource('src/app/(public)/posts/[slug]/page.tsx')
  const articleCss = readSource('src/styles/article.css')

  expect(source).toContain('className="article-prose reader-prose')
  expect(source).not.toContain('prose prose-zinc')
  expect(articleCss).toContain('.article-prose h2 {')
  expect(articleCss).toMatch(/\.article-prose h2 \{[^}]*font-family: var\(--font-serif\)/)
  expect(articleCss).toMatch(/\.article-prose h3 \{[^}]*font-weight: 700/)
  expect(articleCss).toContain('font-size: 1.0625rem;\n    line-height: 1.85;')
})

test('public article details use incremental revalidation instead of full runtime rendering', () => {
  const source = readSource('src/app/(public)/posts/[slug]/page.tsx')

  expect(source).toContain('export const revalidate = 300')
  expect(source).toContain('export const dynamicParams = true')
  expect(source).toContain('export async function generateStaticParams()')
  expect(source).toContain('where: { published: true, deletedAt: null }')
  expect(source).not.toContain('getServerSession')
  expect(source).not.toContain('authOptions')
  expect(source).not.toContain('export const dynamic = "force-dynamic"')
})

test('admin draft preview stays on a dynamic protected route', () => {
  const source = readSource('src/app/admin/posts/preview/[slug]/page.tsx')

  expect(source).toContain('export const dynamic = "force-dynamic"')
  expect(source).toContain('renderArticlePage({ slug, includeDraft: true })')
})

test('article page widens the paper and lays out article column, 1px rule and toc rail', () => {
  const componentSource = readSource('src/styles/components.css')
  const articleCss = readSource('src/styles/article.css')
  const globals = readSource('src/app/globals.css')

  expect(componentSource).toContain('.reader-shell:has(.article-detail-page)')
  expect(globals).toContain('@import "../styles/article.css";')
  expect(articleCss).toContain('grid-template-columns: minmax(0, var(--article-reading-max-width)) 1px minmax(9rem, 1fr);')
  expect(articleCss).toContain('.article-layout__rule')
})

test('article quotes keep only the warm 2px rail and code blocks sit on surface-alt with a hairline', () => {
  const articleCss = readSource('src/styles/article.css')

  expect(articleCss).toMatch(/\.article-prose blockquote \{[^}]*border-left: 2px solid var\(--accent-warm\)/)
  expect(articleCss).not.toMatch(/\.article-prose blockquote \{[^}]*background/)
  expect(articleCss).toMatch(/\.article-code \{[^}]*border: 1px solid var\(--reader-border\)[^}]*border-radius: var\(--radius-ctl\)[^}]*background: var\(--surface-alt\)/)
  expect(articleCss).toMatch(/\.article-code pre \{[^}]*overflow-x: auto[^}]*white-space: pre;/)
})

test('highlight styles use token mixes instead of hard-coded hex colors', () => {
  const source = readSource('src/styles/code-highlight.css')

  expect(source).not.toMatch(/#[\da-f]{3,8}\b/i)
  expect(source).toContain('var(--accent-warm)')
  expect(source).toContain('var(--accent-cyan)')
  expect(source).toContain('var(--text-muted)')
})

test('fenced code blocks reset inline code chip background', () => {
  const source = readSource('src/styles/code-highlight.css')

  expect(source).toContain('.prose pre code')
  expect(source).toContain('background: transparent')
  expect(source).toContain('padding: 0')
  expect(source).toContain('border-radius: 0')
})

test('markdown article images render as 4px figures with captions', () => {
  const source = readSource('src/app/(public)/posts/[slug]/page.tsx')
  const articleCss = readSource('src/styles/article.css')

  expect(source).toContain('img: ({ src, alt, title }) =>')
  expect(source).toContain('className="article-figure"')
  expect(articleCss).toMatch(/\.article-figure \{[^}]*border-radius: var\(--radius-ctl\)/)
  expect(articleCss).toContain('.article-figure__caption')
})
