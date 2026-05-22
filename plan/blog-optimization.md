# 博客对标优化完整实施方案

> 对标 Josh Comeau / Lee Robinson / Overreacted 等优质博客，系统补齐阅读体验、性能、可访问性与内容发现方面的短板。
>
> **生成日期**：2026-05-21
> **排除项**：Web Share API / 平台分享按钮（Twitter、微信等）
> **技术栈**：Next.js 16 · React 19 · Motion 12 · Tailwind CSS v4 · Prisma 7 · vaul · react-hook-form · zod · sonner

---

## 背景：差距分析摘要

经对照当前代码库与优质博客标准，核心短板如下：

| 维度 | 状态 | 主要问题 |
|------|------|---------|
| RSS 订阅 | 🔴 缺失 | Footer 链接 `/rss.xml` 存在但路由 404 |
| 图片加载 | 🟡 待优化 | PostCard 封面无 blur placeholder，加载时白色闪烁 |
| 移动端 TOC | 🔴 缺失 | ArticleToc 仅 `xl:block`，手机用户无法使用目录 |
| 相关文章 | 🔴 缺失 | 文章底部仅有前后篇，无标签相关推荐 |
| 代码行号 | 🟡 待优化 | rehype-highlight 无行号，技术博客标配缺失 |
| 动效偏好 | 🔴 缺失 | 不支持 `prefers-reduced-motion`，无障碍合规风险 |
| ARIA 语义 | 🟡 不完整 | 评论区、TOC aside 缺少地标标注 |
| 联系页 | 🟡 不完整 | About 页有 CTA 但无独立 `/contact` 落地页 |
| 热门文章 | 🟡 待优化 | Sidebar 无"热门文章"按阅读量排序 |
| Series 进度 | 🟡 待优化 | SeriesNav 有文字计数但无视觉进度条 |
| 暗模式代码 | 🟡 待优化 | 注释等 token 在暗模式下对比度不足 |

---

## 工作量总览

| 优先级 | 任务数 | 新建文件 | 修改文件 | 新增依赖 |
|--------|--------|----------|----------|----------|
| P0 快速修复 | 3 | 2 | 2 | 0 |
| P1 高价值改进 | 3 | 1 | 4 | 1 |
| P2 中等优先级 | 2 | 3 | 2 | 0 |
| P3 锦上添花 | 3 | 2 | 3 | 0 |
| **合计** | **11** | **8** | **11** | **1** |

唯一新增依赖：`rehype-highlight-code-lines`（~2 KB），其余全部复用已有包。

---

## P0 快速修复

### P0-1 RSS 端点

**优先级依据**：Footer 已有 `/rss.xml` 链接但路由 404，影响 SEO 和订阅用户，10 分钟可修。

#### 涉及文件

| 操作 | 路径 |
|------|------|
| 新建 | `src/app/rss.xml/route.ts` |

#### 实现细节

```ts
// src/app/rss.xml/route.ts
import { getBlogSettings } from '@/lib/blog-settings'
import { prisma } from '@/lib/prisma'

export const revalidate = 300

export async function GET() {
  const [settings, posts] = await Promise.all([
    getBlogSettings(),
    prisma.post.findMany({
      where: { published: true, deletedAt: null },
      select: {
        title: true,
        slug: true,
        excerpt: true,
        publishedAt: true,
        createdAt: true,
        author: { select: { name: true } },
        category: { select: { name: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: 20,
    }),
  ])

  const siteUrl = settings.siteUrl.replace(/\/$/, '')

  const items = posts
    .map((post) => {
      const pubDate = (post.publishedAt || post.createdAt).toUTCString()
      const link = `${siteUrl}/posts/${post.slug}`
      return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <description>${post.excerpt ? escapeXml(post.excerpt) : ''}</description>
      <pubDate>${pubDate}</pubDate>
      ${post.author?.name ? `<author>${escapeXml(post.author.name)}</author>` : ''}
      ${post.category?.name ? `<category>${escapeXml(post.category.name)}</category>` : ''}
    </item>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(settings.siteName)}</title>
    <link>${siteUrl}</link>
    <description>${escapeXml(settings.siteDescription || settings.siteName)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${siteUrl}/rss.xml" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=86400',
    },
  })
}

function escapeXml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
```

#### 关键决策

- `revalidate = 300` 与首页一致，ISR 自动更新
- `atom:link` 自引用是 RSS 验证器要求，不可省
- 纯字符串拼接 XML，避免引入 xml-builder 类依赖
- `escapeXml` 手写而非 `encodeURIComponent`，后者会过度编码

#### 验收标准

```bash
curl http://localhost:3001/rss.xml
# 期望：<?xml version="1.0"... 开头的合法 XML，含文章条目
# 期望：Content-Type: application/xml
# 期望：Footer 链接不再 404
```

---

### P0-2 图片 Blur Placeholder

**优先级依据**：文章列表封面图加载时白色闪烁，视觉割裂感强；改动极小，2 个文件各加几行。

#### 涉及文件

| 操作 | 路径 |
|------|------|
| 新建 | `src/lib/image-placeholder.ts` |
| 修改 | `src/components/blog/PostCard.tsx` L57–66 |

#### 实现细节

**`src/lib/image-placeholder.ts`**

```ts
// 预计算的 8×5 px 灰色 SVG base64，作为封面图加载期间的占位底色。
// 使用静态常量而非运行时 Buffer.from()，确保客户端组件可直接引用。
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="5">
  <rect width="8" height="5" fill="#cbd5e1"/>
</svg>`

export const shimmerBlurDataURL =
  `data:image/svg+xml;base64,${btoa(svg)}`
```

> `btoa` 在现代浏览器和 Node.js 18+ 均可用，无需 `Buffer`。

**`PostCard.tsx` 修改位置（L57–66）**

```tsx
// 修改前
<FallbackImage
  alt={post.title}
  className="theme-media-image object-cover"
  fill
  loading="lazy"
  quality={70}
  sizes="(min-width: 1800px) 14rem, (max-width: 768px) 100vw, 11rem"
  src={post.coverImage!}
  fallbackSrc={READER_CARD_FALLBACK_SRC}
/>

// 修改后（新增 placeholder + blurDataURL）
import { shimmerBlurDataURL } from '@/lib/image-placeholder'

<FallbackImage
  alt={post.title}
  className="theme-media-image object-cover"
  fill
  loading="lazy"
  placeholder="blur"
  blurDataURL={shimmerBlurDataURL}
  quality={70}
  sizes="(min-width: 1800px) 14rem, (max-width: 768px) 100vw, 11rem"
  src={post.coverImage!}
  fallbackSrc={READER_CARD_FALLBACK_SRC}
/>
```

#### 关键决策

- `FallbackImage` 通过 `...props` 透传所有 `ImageProps`，无需改动该组件
- 外部 URL 图片必须手动提供 `blurDataURL`，Next.js 不会自动生成
- 选择静态 SVG 而非 shimmer 动画，避免在已有 Motion 动画的页面上叠加动效

#### 验收标准

- 文章列表页慢网络下封面区域显示灰色底色，无白色闪烁
- 浏览器 DevTools Network → 图片加载前 `<img>` 元素有 `src="data:image/svg+xml;base64,..."` 占位

---

### P0-3 移动端 TOC 抽屉

**优先级依据**：TOC 在 `xl` 以下完全隐藏，手机用户阅读长文无法跳转，是优质博客的标配功能。

#### 涉及文件

| 操作 | 路径 |
|------|------|
| 新建 | `src/components/blog/ArticleTocDrawer.tsx` |
| 修改 | `src/app/(public)/posts/[slug]/page.tsx` L322 |

#### 实现细节

**`ArticleTocDrawer.tsx`**

```tsx
'use client'

import { List } from 'lucide-react'
import { Drawer } from 'vaul'
import { ArticleToc } from './ArticleToc'

interface TocHeading {
  id: string
  text: string
  level: 1 | 2 | 3
}

export function ArticleTocDrawer({ headings }: { headings: TocHeading[] }) {
  if (headings.length === 0) return null

  return (
    <Drawer.Root>
      <Drawer.Trigger asChild>
        <button
          aria-label="打开文章目录"
          className="fixed bottom-20 right-4 z-40 inline-flex items-center gap-1.5 rounded-full border border-[var(--reader-border)] bg-[var(--reader-panel)] px-3 py-2 text-xs font-semibold text-[var(--foreground)] shadow-lg backdrop-blur-sm transition hover:bg-[var(--reader-panel-elevated)] xl:hidden"
        >
          <List className="h-3.5 w-3.5" aria-hidden="true" />
          目录
        </button>
      </Drawer.Trigger>

      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[80vh] flex-col rounded-t-2xl border-t border-[var(--reader-border)] bg-[var(--reader-panel)] p-5 focus:outline-none xl:hidden">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--reader-border)]" />
          <Drawer.Title className="mb-4 font-display text-lg font-semibold text-[var(--foreground)]">
            目录
          </Drawer.Title>
          <div className="overflow-y-auto">
            <ArticleToc headings={headings} />
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
```

**`[slug]/page.tsx` 修改（L322 附近）**

```tsx
// 引入
import { ArticleTocDrawer } from '@/components/blog'

// 渲染区（在 <BackToTopButton /> 之后追加）
<ArticleReadTracker postId={post.id} />
<ReadingProgress />
<BackToTopButton />
<ArticleTocDrawer headings={headings} />  {/* 新增 */}
```

同时将 `ArticleTocDrawer` 加入 `src/components/blog/index.ts` 导出。

#### 关键决策

- 复用已有 `vaul` 包（package.json 已引入），不引入新依赖
- 复用现有 `ArticleToc` 组件，不重复实现 IntersectionObserver 逻辑
- `xl:hidden` 确保桌面端不渲染，不与右侧固定 TOC 冲突
- `bottom-20` 避开底部导航区域（与 `BackToTopButton` 错开位置）

#### 验收标准

- 手机端文章页右下角出现"目录"浮动按钮
- 点击弹出抽屉，可滚动，点击条目后自动关闭并跳转锚点
- `xl`（1280px）及以上视口不显示该按钮

---

## P1 高价值改进

### P1-1 相关文章

**优先级依据**：减少跳出率的核心手段；基于已有 tags 数据，无需新表，Prisma 查询即可实现。

#### 涉及文件

| 操作 | 路径 |
|------|------|
| 新建 | `src/components/blog/ArticleRelatedPosts.tsx` |
| 修改 | `src/app/(public)/posts/[slug]/page.tsx` |

#### 实现细节

**新增查询函数（`[slug]/page.tsx` 内，`getContinuationData` 之后）**

```ts
async function getRelatedPosts(postId: string, tagSlugs: string[], limit = 3) {
  if (tagSlugs.length === 0) return []

  return prisma.post.findMany({
    where: {
      id: { not: postId },
      published: true,
      deletedAt: null,
      tags: { some: { slug: { in: tagSlugs }, deletedAt: null } },
    },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      coverImage: true,
      createdAt: true,
      category: { select: { name: true, slug: true } },
    },
    orderBy: { publishedAt: 'desc' },
    take: limit,
  })
}
```

**`PostPage` 内并发调用（修改现有 `getContinuationData` 调用处）**

```ts
// 修改前
const { previousPost, nextPost } = await getContinuationData(post)

// 修改后
const [{ previousPost, nextPost }, relatedPosts] = await Promise.all([
  getContinuationData(post),
  getRelatedPosts(post.id, post.tags.map((t) => t.slug)),
])
```

**渲染位置（SeriesNav 之后，L426 附近）**

```tsx
{post.series && !post.series.deletedAt ? (
  <SeriesNav ... />
) : null}

<ArticleRelatedPosts posts={relatedPosts} />  {/* 新增 */}
```

**`ArticleRelatedPosts.tsx`**

```tsx
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { SectionHeader } from './SectionHeader'

type RelatedPost = {
  id: string
  title: string
  slug: string
  excerpt?: string | null
  createdAt: string | Date
  category?: { name: string; slug: string } | null
}

export function ArticleRelatedPosts({ posts }: { posts: RelatedPost[] }) {
  if (posts.length === 0) return null

  return (
    <section className="reader-panel w-full space-y-5 p-6 sm:p-8">
      <SectionHeader eyebrow="延伸阅读" title="相关文章" />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <li key={post.id}>
            <Link
              href={`/posts/${post.slug}`}
              className="reader-feed-card group flex h-full flex-col gap-3 p-4"
            >
              {post.category && (
                <span className="reader-chip self-start">{post.category.name}</span>
              )}
              <h3 className="line-clamp-2 text-sm font-bold leading-snug text-[var(--foreground)] transition-colors group-hover:text-[color:color-mix(in_oklab,var(--accent-sky)_82%,var(--foreground)_18%)]">
                {post.title}
              </h3>
              {post.excerpt && (
                <p className="line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">
                  {post.excerpt}
                </p>
              )}
              <p className="mt-auto text-xs text-[var(--text-faint)]">
                {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: zhCN })}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

#### 关键决策

- `Promise.all` 并发，不增加串行延迟
- 无标签文章直接返回 `[]`，组件 `return null`，不渲染空区块
- 取 `publishedAt DESC` 而非标签重叠数，实现简单且结果足够相关
- `date-fns` 已在依赖中，直接使用相对时间展示

#### 验收标准

- 有共同标签的文章，底部出现"相关文章"区块，展示 1–3 篇
- 当前文章无标签或无同标签文章时，区块不渲染
- 点击跳转正确

---

### P1-2 代码块行号

**优先级依据**：技术博客标配，读者讨论代码时需要引用行号；单个依赖 + CSS 即可实现。

#### 涉及文件

| 操作 | 路径 |
|------|------|
| 新增依赖 | `rehype-highlight-code-lines` |
| 修改 | `src/app/(public)/posts/[slug]/page.tsx` L21–22 |
| 修改 | `src/styles/code-highlight.css` |

#### 实现细节

**安装**

```bash
pnpm add rehype-highlight-code-lines
```

**`[slug]/page.tsx` rehypePlugins 配置**

```ts
// 修改前（L21-22）
import rehypeHighlight from 'rehype-highlight'

// 修改后
import rehypeHighlight from 'rehype-highlight'
import rehypeHighlightCodeLines from 'rehype-highlight-code-lines'

// ReactMarkdown rehypePlugins（约 L343）
rehypePlugins={[
  rehypeHighlight,
  [rehypeHighlightCodeLines, { showLineNumbers: true }],
]}
```

> 注意：`rehypeHighlightCodeLines` 必须排在 `rehypeHighlight` 之后，它处理高亮后的输出。

**`code-highlight.css` 追加行号样式**

```css
/* 代码块行号 */
.reader-prose pre code .code-line,
.prose pre code .code-line {
  display: block;
  padding-left: 3.25rem;
  position: relative;
  min-height: 1.5em;
}

.reader-prose pre code .code-line::before,
.prose pre code .code-line::before {
  content: attr(data-line-number);
  position: absolute;
  left: 0;
  width: 2.75rem;
  padding-right: 0.75rem;
  text-align: right;
  color: var(--text-faint);
  font-size: 0.75em;
  line-height: 1.5em;
  user-select: none;
  pointer-events: none;
  border-right: 1px solid color-mix(in oklab, var(--reader-border) 60%, transparent);
}
```

#### 关键决策

- 选择 `rehype-highlight-code-lines` 而非替换为 `rehype-pretty-code`（后者依赖 shiki，包体大得多）
- `user-select: none` + `pointer-events: none` 确保行号不影响复制操作
- `border-right` 分隔线提升视觉层次

#### 验收标准

- 所有有语言标注的代码块左侧显示行号（1, 2, 3...）
- 全选代码复制后，行号不出现在剪贴板内容中
- 现有 `CopyCodeButton` 功能不受影响

---

### P1-3 prefers-reduced-motion

**优先级依据**：无障碍合规基本要求；前庭功能障碍用户依赖此偏好；CSS + Motion.js 两行改动即可覆盖全站。

#### 涉及文件

| 操作 | 路径 |
|------|------|
| 修改 | `src/styles/animations.css`（末尾追加） |
| 修改 | `src/app/layout.tsx` |

#### 实现细节

**`animations.css` 末尾追加**

```css
/* 尊重用户系统"减少动态效果"偏好 */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**`src/app/layout.tsx` 修改**

```tsx
// 新增引入
import { MotionConfig } from 'motion/react'

// body 内层包裹（现有 ThemeProvider 等 provider 外层）
<MotionConfig reducedMotion="user">
  {/* 原有内容 */}
</MotionConfig>
```

#### 两层方案说明

| 层 | 覆盖范围 | 机制 |
|----|---------|------|
| CSS `@media` | 所有 CSS `transition` / `animation` | 强制压缩到 0.01ms |
| `MotionConfig reducedMotion="user"` | 所有 `motion/*` 组件动画 | Motion.js 读取系统偏好，自动跳过动画帧 |

两层缺一不可：CSS 层覆盖 Tailwind `transition-*`，Motion 层覆盖 Spring / keyframe 动画。

#### 验收标准

- macOS：系统偏好 → 辅助功能 → 减少动态效果 开启后，页面所有动画（hover、页面切换、卡片入场）瞬间完成
- Windows：系统 → 辅助功能 → 视觉效果 → 动画效果 关闭后，同上

---

## P2 中等优先级

### P2-1 ARIA 标注完善

**优先级依据**：无需新文件，4 处单行修改，直接提升屏幕阅读器体验与 Lighthouse Accessibility 评分。

#### 涉及文件

| 操作 | 路径 |
|------|------|
| 修改 | `src/app/(public)/posts/[slug]/page.tsx` |

#### 逐行改动清单

```
文件：src/app/(public)/posts/[slug]/page.tsx
```

**改动 1 — 评论区 section 标注（L466）**

```tsx
// 修改前
<section className="reader-panel w-full p-6 sm:p-8" id="comments">

// 修改后
<section className="reader-panel w-full p-6 sm:p-8" id="comments" aria-labelledby="comments-heading">
```

**改动 2 — 评论标题 id（L467）**

```tsx
// 修改前
<h2 className="mb-3 font-display text-2xl font-bold text-[var(--foreground)]">
  评论 ({post._count.comments})
</h2>

// 修改后
<h2 id="comments-heading" className="mb-3 font-display text-2xl font-bold text-[var(--foreground)]">
  评论 ({post._count.comments})
</h2>
```

**改动 3 — TOC aside 标注（L478）**

```tsx
// 修改前
<aside
  data-testid="toc-rail"
  className="article-toc-rail hidden ..."
  style={...}
>

// 修改后
<aside
  data-testid="toc-rail"
  aria-label="文章目录"
  className="article-toc-rail hidden ..."
  style={...}
>
```

**改动 4 — TOC 内容区改为 nav（L485–489）**

```tsx
// 修改前
<div className="reader-panel max-h-[var(--article-toc-card-max-height)] overflow-auto p-5">
  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">On this page</p>
  <h3 className="mb-4 font-display text-lg font-semibold text-[var(--foreground)]">目录</h3>
  <ArticleToc headings={headings} />
</div>

// 修改后
<nav aria-label="本文目录" className="reader-panel max-h-[var(--article-toc-card-max-height)] overflow-auto p-5">
  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]" aria-hidden="true">On this page</p>
  <h2 className="mb-4 font-display text-lg font-semibold text-[var(--foreground)]">目录</h2>
  <ArticleToc headings={headings} />
</nav>
```

> 将 `<h3>` 改为 `<h2>` 是因为该 `<nav>` 在 `<aside>` 内，h3 在文档大纲中层级过深。

#### 验收标准

- VoiceOver / NVDA 的地标导航（Rotor）中可直接跳转"文章目录"和"评论"两个地标
- Lighthouse Accessibility 评分不下降（目标 ≥95）

---

### P2-2 联系页 /contact

**优先级依据**：About 页 CTA 的转化终点缺失；使用已有 react-hook-form + zod + sonner，零新依赖。

#### 涉及文件

| 操作 | 路径 |
|------|------|
| 新建 | `src/app/(public)/contact/page.tsx` |
| 新建 | `src/app/(public)/contact/ContactForm.tsx` |
| 修改 | `.env.example`（追加 1 行） |

#### 实现细节

**`contact/page.tsx`**

```tsx
import type { Metadata } from 'next'
import { getBlogSettings } from '@/lib/blog-settings'
import { buildPageMetadata } from '@/lib/seo'
import { ContactForm } from './ContactForm'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getBlogSettings()
  return buildPageMetadata({
    title: `联系我 | ${settings.siteName}`,
    description: '有问题、合作意向或想聊聊，欢迎发邮件联系。',
    path: '/contact',
    siteUrl: settings.siteUrl,
  })
}

export default function ContactPage() {
  return (
    <div className="reader-panel mx-auto max-w-2xl space-y-8 p-8">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--text-muted)]">联系</p>
        <h1 className="font-display text-3xl font-bold text-[var(--foreground)]">联系我</h1>
        <p className="text-[var(--text-body)]">
          有问题、合作意向或只是想聊聊，填写下方表单或直接发邮件。
        </p>
      </div>
      <ContactForm />
    </div>
  )
}
```

**`contact/ContactForm.tsx`**

```tsx
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

const schema = z.object({
  name: z.string().optional(),
  email: z.string().email('请输入有效的邮箱地址'),
  subject: z.string().min(2, '主题至少 2 个字'),
  message: z.string().min(20, '内容至少 20 个字'),
})

type FormValues = z.infer<typeof schema>

export function ContactForm() {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  const onSubmit = (data: FormValues) => {
    const to = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? ''
    const body = `姓名：${data.name ?? '未填写'}\n\n${data.message}`
    const mailto = `mailto:${to}?subject=${encodeURIComponent(data.subject)}&body=${encodeURIComponent(body)}`
    window.location.href = mailto
    toast.success('已打开邮件客户端，请发送邮件。')
    reset()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="name" className="text-sm font-medium text-[var(--foreground)]">
            姓名 <span className="text-[var(--text-faint)]">（可选）</span>
          </label>
          <input id="name" {...register('name')} className="reader-input w-full" placeholder="你的名字" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-[var(--foreground)]">
            邮箱 <span className="text-red-500">*</span>
          </label>
          <input id="email" type="email" {...register('email')} className="reader-input w-full" placeholder="you@example.com" />
          {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="subject" className="text-sm font-medium text-[var(--foreground)]">
          主题 <span className="text-red-500">*</span>
        </label>
        <input id="subject" {...register('subject')} className="reader-input w-full" placeholder="简短描述你的问题或想法" />
        {errors.subject && <p className="text-xs text-red-500">{errors.subject.message}</p>}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="message" className="text-sm font-medium text-[var(--foreground)]">
          内容 <span className="text-red-500">*</span>
        </label>
        <textarea
          id="message"
          rows={6}
          {...register('message')}
          className="reader-input w-full resize-y"
          placeholder="详细描述..."
        />
        {errors.message && <p className="text-xs text-red-500">{errors.message.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--accent-sky)] px-6 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
      >
        发送邮件
      </button>
    </form>
  )
}
```

**`.env.example` 追加**

```env
# 联系表单收件邮箱（公开到客户端，需 NEXT_PUBLIC_ 前缀）
NEXT_PUBLIC_CONTACT_EMAIL=
```

#### 关键决策

- `mailto:` 方案零后端依赖，无需 Formspree / SendGrid 等第三方服务
- 使用 `NEXT_PUBLIC_` 前缀是因为该值在客户端 JS 中使用
- 若后续需要服务端收件，只需新建 `src/app/api/contact/route.ts` 并将 `onSubmit` 改为 `fetch` 调用

#### 验收标准

- `GET /contact` 正常渲染，无控制台错误
- 填写并提交后打开系统邮件客户端，主题和正文预填正确
- 邮箱格式错误或内容过短时，显示对应中文错误提示

---

## P3 锦上添花

### P3-1 热门文章 Widget

**优先级依据**：提升内容发现性；Sidebar 已有 client-side fetch 模式，新增一个 `/api/posts/popular` 即可。

#### 涉及文件

| 操作 | 路径 |
|------|------|
| 新建 | `src/app/api/posts/popular/route.ts` |
| 新建 | `src/components/blog/PopularPostsWidget.tsx` |
| 修改 | `src/components/layout/Sidebar.tsx` |

#### 实现细节

**`popular/route.ts`**

```ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const revalidate = 300

export async function GET() {
  const posts = await prisma.post.findMany({
    where: { published: true, deletedAt: null, viewCount: { gt: 0 } },
    select: { id: true, title: true, slug: true, viewCount: true },
    orderBy: { viewCount: 'desc' },
    take: 5,
  })
  return NextResponse.json({ data: posts })
}
```

**`PopularPostsWidget.tsx`**

```tsx
import NextLink from 'next/link'
import { Flame } from 'lucide-react'
import { Eye } from 'lucide-react'

type PopularPost = { id: string; title: string; slug: string; viewCount: number }

export function PopularPostsWidget({ posts }: { posts: PopularPost[] }) {
  if (posts.length === 0) return null

  return (
    <section className="reader-panel p-4" aria-labelledby="sidebar-popular-title">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-4 w-1 rounded-full bg-(--accent-warm)" aria-hidden="true" />
        <Flame className="h-4 w-4 text-[var(--text-body)]" aria-hidden="true" />
        <h3 id="sidebar-popular-title" className="font-bold text-[var(--foreground)]">热门文章</h3>
      </div>
      <ol className="space-y-2">
        {posts.map((post, index) => (
          <li key={post.id} className="flex items-start gap-2.5">
            <span className="mt-0.5 w-4 shrink-0 text-center text-xs font-bold tabular-nums text-[var(--text-faint)]">
              {index + 1}
            </span>
            <NextLink
              href={`/posts/${post.slug}`}
              className="group flex min-w-0 flex-1 flex-col gap-1"
            >
              <span className="line-clamp-2 text-sm leading-snug text-[var(--text-body)] transition group-hover:text-[var(--foreground)]">
                {post.title}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-[var(--text-faint)]">
                <Eye className="h-3 w-3" aria-hidden="true" />
                {post.viewCount.toLocaleString()}
              </span>
            </NextLink>
          </li>
        ))}
      </ol>
    </section>
  )
}
```

**`Sidebar.tsx` 修改**

```ts
// 1. 新增 state
const [popularPosts, setPopularPosts] = useState<PopularPost[]>([])

// 2. loadTaxonomy 的 Promise.all 中追加
const [categoriesRes, tagsRes, popularRes] = await Promise.all([
  fetch('/api/categories'),
  fetch('/api/tags'),
  fetch('/api/posts/popular'),
])
const popularJson = await popularRes.json()
setPopularPosts(Array.isArray(popularJson?.data) ? popularJson.data : [])

// 3. 渲染位置：tags section 之后，readingStats 之前
<PopularPostsWidget posts={popularPosts} />
```

#### 验收标准

- Sidebar 标签区块下方出现"热门文章"列表，展示阅读量前 5 篇
- 所有文章 viewCount 为 0 时组件不渲染
- API 请求失败时 `popularPosts` 保持 `[]`，组件静默隐藏

---

### P3-2 Series 进度条

**优先级依据**：一行组件修改，5 行 JSX，让系列阅读进度一目了然。

#### 涉及文件

| 操作 | 路径 |
|------|------|
| 修改 | `src/components/blog/SeriesNav.tsx` L35–37 |

#### 实现细节

在 [SeriesNav.tsx](src/components/blog/SeriesNav.tsx) 的进度文字（当前 L36）之后追加进度条：

```tsx
// 修改前（L34-37）
<div className="flex flex-wrap items-center justify-between gap-3">
  <Link href={`/series/${series.slug}`} ...>...</Link>
  <span className="text-50 text-xs">
    {Math.max(currentIndex + 1, 1)} / {posts.length}
  </span>
</div>

// 修改后
<div className="flex flex-wrap items-center justify-between gap-3">
  <Link href={`/series/${series.slug}`} ...>...</Link>
  <span className="text-50 text-xs">
    {Math.max(currentIndex + 1, 1)} / {posts.length}
  </span>
</div>
<div className="h-1 w-full overflow-hidden rounded-full bg-(--reader-border)">
  <div
    className="h-full rounded-full bg-(--accent-warm) transition-[width] duration-300"
    style={{ width: `${Math.round((Math.max(currentIndex + 1, 1) / posts.length) * 100)}%` }}
  />
</div>
```

#### 验收标准

- SeriesNav 进度文字下方显示彩色进度条
- 第 1 篇时宽度为 `1/N × 100%`，最后一篇为 100%
- 进度条宽度变化有 300ms 过渡动画（`prefers-reduced-motion` 开启时自动跳过，见 P1-3）

---

### P3-3 暗模式代码块对比度

**优先级依据**：暗模式下注释等 token 颜色对比度不足，影响阅读舒适度；纯 CSS 修改。

#### 涉及文件

| 操作 | 路径 |
|------|------|
| 修改 | `src/styles/code-highlight.css` |

#### 实现细节

在 `code-highlight.css` 末尾追加 `.dark` 作用域覆盖：

```css
/* 暗模式下提升代码块 token 对比度，满足 WCAG AA (4.5:1) */
html.dark .reader-prose .hljs-comment,
html.dark .reader-prose .hljs-quote,
html.dark .prose .hljs-comment,
html.dark .prose .hljs-quote {
  /* 亮模式用 text-muted 82% + white 18%，暗模式提升至更亮 */
  color: color-mix(in oklab, var(--text-muted) 70%, white 30%);
  font-style: italic;
}

html.dark .reader-prose .hljs-keyword,
html.dark .reader-prose .hljs-selector-tag,
html.dark .prose .hljs-keyword {
  color: color-mix(in oklab, var(--accent-sky) 72%, white 28%);
}

html.dark .reader-prose .hljs-string,
html.dark .reader-prose .hljs-attr,
html.dark .prose .hljs-string,
html.dark .prose .hljs-attr {
  color: color-mix(in oklab, var(--accent-cyan) 72%, white 28%);
}
```

#### 验收标准

- 暗模式下切换到代码块区域，Chrome DevTools Accessibility → Color Contrast 无红色警告
- 注释文字（灰色）在暗背景下清晰可读

---

## 执行顺序建议

```
P0-1 RSS (30min)  →  P0-2 Blur (20min)  →  P0-3 TOC Drawer (60min)
       ↓
P1-3 Motion (20min)  →  P1-2 行号 (40min)  →  P1-1 相关文章 (60min)
       ↓
P2-1 ARIA (10min)  →  P2-2 Contact (60min)
       ↓
P3-2 Series进度 (10min)  →  P3-3 暗模式 (20min)  →  P3-1 热门文章 (60min)
```

每个 P0 任务独立可交付，互不阻塞。P1-3（prefers-reduced-motion）建议在 P0 完成后最先处理，因为它是全局改动，后续所有动画组件都会受益。
