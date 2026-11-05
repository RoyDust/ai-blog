import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from 'vitest'

function readSource(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), 'utf8')
}

test('theme toggle uses semantic token-driven icon styling', () => {
  const source = readSource('src/components/ThemeToggle.tsx')

  expect(source).toContain('text-current')
  expect(source).toContain('theme-toggle-icon-stack')
  expect(source).toContain('data-theme={theme}')
  expect(source).not.toContain('dark:hidden')
  expect(source).not.toContain('dark:block')
  expect(source).not.toMatch(/text-gray-\d+/)
  expect(source).not.toMatch(/dark:text-/)
})

test('theme toggle uses a compositor-friendly crossfade with reduced motion fallback', () => {
  const providerSource = readSource('src/components/ThemeProvider.tsx')
  const animationSource = readSource('src/styles/animations.css')

  expect(providerSource).toContain('startViewTransition')
  expect(providerSource).toContain('prefers-reduced-motion: reduce')
  expect(providerSource).not.toContain('getTransitionRadius')
  expect(animationSource).toContain('theme-crossfade-in')
  expect(animationSource).toContain('html.theme-transitioning::view-transition-new(root)')
  expect(animationSource).toContain('overflow-x: clip')
  expect(animationSource).toContain('html.theme-transitioning *')
  expect(animationSource).toContain('transition-property: opacity, transform !important')
  expect(animationSource).toContain('view-transition-name: none !important')
  expect(animationSource).not.toContain('clip-path: circle')
  expect(animationSource).not.toContain('filter: blur')
  expect(animationSource).toContain('@media (prefers-reduced-motion: reduce)')
})

test('root layout initializes saved theme before hydration', () => {
  const source = readSource('src/app/layout.tsx')

  expect(source).toContain('id="theme-init"')
  expect(source).toContain('<head>')
  expect(source).toContain('<script id="theme-init"')
  expect(source).toContain('window.localStorage.getItem("theme")')
  expect(source).toContain('classList.toggle("dark", theme === "dark")')
  expect(source).not.toContain('className="dark"')
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
  const authSources = [
    'src/components/auth/LoginForm.tsx',
    'src/components/auth/LoginDialog.tsx',
    'src/components/auth/AuthFormParts.tsx',
    'src/app/(auth)/register/page.tsx',
    'src/app/(auth)/layout.tsx',
  ]
    .filter((path) => existsSync(join(process.cwd(), path)))
    .map(readSource)
  const accountEntrySource = readSource('src/components/auth/AccountEntry.tsx')
  const combined = [...authSources, accountEntrySource].join('\n')

  // 账号相关界面全部走语义 token，不再手写灰 / 蓝 / 玫红的明暗配对
  expect(combined).toContain('var(--')
  expect(combined).not.toMatch(/text-rose-\d+/)
  expect(combined).not.toMatch(/text-gray-\d+/)
  expect(combined).not.toMatch(/bg-gray-\d+/)
  expect(combined).not.toMatch(/border-gray-\d+/)
  expect(combined).not.toMatch(/text-blue-\d+/)
  expect(combined).not.toMatch(/bg-blue-\d+/)
  expect(combined).not.toMatch(/dark:text-/)
  expect(combined).not.toMatch(/dark:bg-(?:gray|slate|blue)-/)

  // 导航账号入口：方向 A 图标按钮 + 纸面弹层，菜单项按压底色走 --ed-press-bg，退出用危险色
  expect(accountEntrySource).toContain('className="ed-icon-btn"')
  expect(accountEntrySource).toContain('ed-popover')
  expect(accountEntrySource).toContain('focus:bg-[var(--ed-press-bg)]')
  expect(accountEntrySource).toContain('text-[var(--danger-foreground)]')
  expect(accountEntrySource).toContain('rounded-[var(--radius-ctl)]')
  expect(accountEntrySource).not.toContain('reader-icon-btn')
  expect(accountEntrySource).not.toContain('reader-panel')
  expect(accountEntrySource).not.toMatch(/rounded-(?:xl|2xl|full) [^"]*shadow/)
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
  const editorialSource = readSource('src/styles/editorial.css')

  // 延续的阅读外壳 token
  expect(themeSource).toContain('--reader-nav-height')
  expect(themeSource).toContain('--reader-panel')
  expect(themeSource).toContain('--accent-warm')
  expect(themeSource).toContain('--reader-shadow')
  expect(themeSource).toContain('.admin-theme')

  // 方向 A 新增 token：印章朱红、focus 环、链接色、按压底色、两档圆角、导航实底
  for (const token of ['--accent-seal', '--focus', '--ed-link', '--ed-hover-bg', '--ed-press-bg', '--radius-ctl', '--radius-paper', '--ed-nav-bg']) {
    expect(themeSource).toContain(`${token}:`)
  }

  expect(componentSource).toContain('.reader-shell')
  expect(componentSource).toContain('var(--reader-background-image)')
  expect(componentSource).not.toContain('background: rgb(13 20 28 / 0.92)')

  // 导航条：6px 圆角实底，无毛玻璃、无阴影
  const navRule = componentSource.match(/\.reader-nav\s*\{([^}]*)\}/)?.[1] ?? ''
  expect(navRule).toContain('background: var(--ed-nav-bg)')
  expect(navRule).toContain('border-radius: var(--radius-paper)')
  expect(navRule).not.toContain('backdrop-filter')
  expect(navRule).not.toContain('box-shadow')

  // 方向 A 语义类集中在 editorial.css
  for (const selector of ['.ed-paper', '.ed-row', '.ed-row__thumb', '.ed-seal', '.ed-link', '.ed-tab', '.ed-underline', '.ed-popover', '.ed-section-head', '.ed-icon-btn']) {
    expect(editorialSource).toContain(`${selector} {`)
  }
  const paperRule = editorialSource.match(/\.ed-paper\s*\{([^}]*)\}/)?.[1] ?? ''
  expect(paperRule).toContain('background: var(--card-bg)')
  expect(paperRule).toContain('border-radius: var(--radius-paper)')
  expect(paperRule).not.toContain('backdrop-filter')
})

test('global focus ring keeps a high-contrast light-mode outline contract', () => {
  const themeSource = readSource('src/styles/theme-variables.css')
  const componentSource = readSource('src/styles/components.css')

  expect(themeSource).toContain('--ring: oklch(0.58 0.12 var(--hue));')
  // 方向 A：亮色 focus 用 --ring（#0088AE），暗色用 sky，统一走 --focus（简报 16.1）
  expect(themeSource).toContain('--focus: var(--ring);')
  expect(themeSource).toContain('--focus: var(--accent-sky);')
  expect(componentSource).toContain('outline: 2px solid var(--focus) !important')
  expect(componentSource).toContain('outline-offset: 2px !important')
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

test('sidebar scrollbar hiding overrides the global scrollbar treatment', () => {
  const source = readSource('src/app/globals.css')
  const globalScrollbarRule = source.indexOf('*::-webkit-scrollbar')
  const sidebarScrollbarRule = source.indexOf('.reader-scrollbar-hidden')

  expect(sidebarScrollbarRule).toBeGreaterThan(globalScrollbarRule)
  expect(source).toContain('#sidebar [data-testid="sidebar-taxonomy-rail"]')
  expect(source).toContain('scrollbar-color: transparent transparent')
  expect(source).toContain('scrollbar-width: none')
  expect(source).toContain('display: none')
  expect(source).toContain('width: 0')
  expect(source).toContain('height: 0')
})
