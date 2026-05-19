# SEO 增强改进计划

**审计日期**：2026-05-20
**当前状态**：基础 SEO 完善，存在可提升空间
**预估工作量**：P0 约 1h，P1 约 3h，P2 约 2h，P3 视规模而定

---

## 现状总览

| 能力 | 状态 | 覆盖范围 |
|------|------|---------|
| Metadata 导出 | ✅ 完整 | 全部 14 个公开页面 |
| robots.txt | ✅ 正确 | 动态生成，屏蔽 admin/api |
| sitemap.xml | ✅ 完整 | 含文章/分类/标签/系列，带 priority |
| JSON-LD 结构化数据 | ⚠️ 部分 | 仅文章页有 BlogPosting + BreadcrumbList |
| OG 图片生成 | ⚠️ 部分 | 根页面 + 文章详情；分类/标签/系列缺失 |
| RSS Feed | ✅ 完整 | 最新 20 篇，格式标准 |
| Canonical URL | ✅ 完整 | 所有页面通过 `alternates.canonical` 设置 |
| Twitter Cards | ✅ 完整 | 有图用 summary_large_image，否则 summary |
| noindex 标记 | ✅ 正确 | 搜索/书签/认证页已标记 |
| SEO 单元测试 | ✅ 存在 | seo.test.ts + seo-pages-metadata.test.ts |

**核心问题**：OG 图片声明缺少尺寸/类型属性；分类、标签、系列详情页无专属 OG 图片；JSON-LD 覆盖不足；部分 OpenGraph 字段缺失。

---

## P0 — 低成本高收益（约 1h）

这些修改只需改 `src/lib/seo.ts` 的辅助函数，影响所有调用页面，零风险。

### P0-1：OG 图片补充 width / height / type 属性

**问题**：`buildPageMetadata` 和 `buildArticleMetadata` 传入 `images` 时只有 `{ url: image }`，缺少 `width`、`height`、`type`。LinkedIn、Discord、Slack 等平台在预解析时依赖这些字段决定是否发起图片请求；缺失会导致预览加载变慢或回退到文字卡片。

**影响页面**：所有调用 `buildPageMetadata` / `buildArticleMetadata` 的页面（14 个）。

**改动位置**：[src/lib/seo.ts](src/lib/seo.ts)

```ts
// 修改前
images: image ? [{ url: image }] : undefined,

// 修改后（适用于 buildPageMetadata 的 openGraph.images）
images: image
  ? [{ url: image, width: 1200, height: 630, type: 'image/png' }]
  : undefined,
```

同样修改 `twitter.images`（Twitter 只需 url，不需要加属性，保持不变即可）。

**验证**：运行 `pnpm vitest run src/lib/__tests__/seo.test.ts`，然后用 [Meta Tags](https://metatags.io) 或 [OpenGraph.xyz](https://www.opengraph.xyz) 预览。

---

### P0-2：文章 OG 补充 `article:author` 字段

**问题**：`buildArticleMetadata` 设置了 `og:type: article` 和时间字段，但漏掉了 `article:author`。Facebook / Open Graph 协议期望 article 类型包含作者信息，部分聚合平台会读取此字段。

**改动位置**：[src/lib/seo.ts](src/lib/seo.ts) 的 `buildArticleMetadata` + 调用它的文章详情页。

```ts
// buildArticleMetadata 新增 authorName 参数
export function buildArticleMetadata({
  title, description, path, image,
  publishedTime, modifiedTime, authorName, siteUrl,
}: { ...existing...; authorName?: string } & SiteMetadataOptions): Metadata {
  return {
    ...metadata,
    openGraph: {
      ...metadata.openGraph,
      type: 'article',
      publishedTime,
      modifiedTime,
      authors: authorName ? [authorName] : undefined,
    },
  }
}
```

**调用侧**：`src/app/(public)/posts/[slug]/page.tsx` 的 `generateMetadata` 已有 `post.author.name`，直接传入即可。

---

### P0-3：OG 图片补充 `alt` 文本

**问题**：所有 `images` 数组缺少 `alt` 字段。屏幕阅读器和部分爬虫会使用 `og:image:alt`。

**改动位置**：[src/lib/seo.ts](src/lib/seo.ts)

```ts
images: image
  ? [{ url: image, width: 1200, height: 630, type: 'image/png', alt: title }]
  : undefined,
```

`buildArticleMetadata` 中 title 已有，直接复用。

---

## P1 — 中成本高收益（约 3h）

### P1-1：为分类/标签/系列详情页生成专属 OG 图片

**问题**：分类、标签、系列详情页目前回退到根页面的通用 OG 图片（显示"My Blog + RSS/Blog/Archive"），在社交分享时无法体现具体内容，点击率低。

**参考实现**：文章详情页已有 [src/app/(public)/posts/[slug]/opengraph-image.tsx](src/app/(public)/posts/[slug]/opengraph-image.tsx)，样式完整，可直接复用设计语言。

#### 分类详情页 OG 图片

**新建文件**：`src/app/(public)/categories/[slug]/opengraph-image.tsx`

内容展示：
- 顶部：站点名 + "分类" 标签
- 主体：分类名（大字）+ 分类描述（如有）
- 底部：文章数量（"共 N 篇文章"）

```tsx
import { ImageResponse } from 'next/og'
import { getBlogSettings } from '@/lib/blog-settings'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const fontDataPromise = fetch(
  new URL('../../../../../../public/font/AlibabaPuHuiTi-3-65-Medium.woff2', import.meta.url)
).then(r => r.arrayBuffer()).catch(() => null)

async function getCategory(slug: string) {
  const { prisma } = await import('@/lib/prisma')
  return prisma.category.findFirst({
    where: { slug, deletedAt: null },
    select: {
      name: true,
      description: true,
      _count: { select: { posts: { where: { published: true, deletedAt: null } } } },
    },
  })
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [settings, category, fontData] = await Promise.all([
    getBlogSettings(), getCategory(slug), fontDataPromise,
  ])

  const name = category?.name || slug
  const description = category?.description || settings.siteDescription
  const count = category?._count.posts ?? 0

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
        justifyContent: 'space-between', background: '#fbfaf6', color: '#1d2721',
        padding: '64px', fontFamily: 'Alibaba PuHuiTi', border: '24px solid #e7ddcc',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: '26px', color: '#5f7369' }}>{settings.siteName}</div>
          <div style={{
            border: '2px solid #cfc2ad', borderRadius: '999px',
            padding: '10px 18px', fontSize: '22px', color: '#6d5f4d',
          }}>分类</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <h1 style={{ margin: 0, fontSize: '88px', lineHeight: 1.08 }}>{name}</h1>
          {description && (
            <p style={{ margin: 0, fontSize: '30px', lineHeight: 1.38, color: '#5c685f', maxWidth: '940px' }}>
              {description}
            </p>
          )}
        </div>
        <div style={{ fontSize: '24px', color: '#6d5f4d' }}>共 {count} 篇文章</div>
      </div>
    ),
    {
      ...size,
      fonts: fontData ? [{ name: 'Alibaba PuHuiTi', data: fontData, style: 'normal', weight: 600 }] : undefined,
    }
  )
}
```

#### 标签详情页 OG 图片

**新建文件**：`src/app/(public)/tags/[slug]/opengraph-image.tsx`

与分类图片结构相同，顶部标签改为"标签"，主体展示标签名。

#### 系列详情页 OG 图片

**新建文件**：`src/app/(public)/series/[slug]/opengraph-image.tsx`

额外展示字段：系列介绍（description）+ 文章数量。

---

### P1-2：为分类/标签/系列详情页添加 BreadcrumbList JSON-LD

**问题**：BreadcrumbList 目前只在文章页注入。Google 对层级页面（分类 → 文章）的面包屑展示依赖此 schema，缺失会导致搜索结果页无富文本面包屑。

**已有工具**：`buildBreadcrumbJsonLd` 已在 [src/lib/seo.ts](src/lib/seo.ts) 实现。

**改动位置**：

1. `src/app/(public)/categories/[slug]/page.tsx` — 在页面 JSX 中注入：

```tsx
const breadcrumb = buildBreadcrumbJsonLd([
  { name: '首页', path: '/' },
  { name: '分类', path: '/categories' },
  { name: category.name, path: `/categories/${category.slug}` },
])

// 在 return 的顶层加：
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
/>
```

2. `src/app/(public)/tags/[slug]/page.tsx` — 同上，路径换成 `/tags`
3. `src/app/(public)/series/[slug]/page.tsx` — 同上，路径换成 `/series`

---

### P1-3：首页添加 WebSite JSON-LD（含 SearchAction）

**问题**：首页缺少 `WebSite` schema，Google 无法识别站点搜索框（Sitelinks Search Box）；`SearchAction` 可以将博客内置搜索接入 Google 搜索结果页的直接跳转。

**改动位置**：`src/app/(public)/page.tsx`

```tsx
// 在 seo.ts 中新增 buildWebSiteJsonLd 辅助函数
export function buildWebSiteJsonLd({ siteName, siteUrl, searchPath }: {
  siteName: string; siteUrl?: string; searchPath?: string
}) {
  const url = siteUrl || getSiteUrl()
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    url,
    ...(searchPath ? {
      potentialAction: {
        '@type': 'SearchAction',
        target: { '@type': 'EntryPoint', urlTemplate: `${url}${searchPath}?q={search_term_string}` },
        'query-input': 'required name=search_term_string',
      },
    } : {}),
  }
}

// 在首页 page.tsx 的 JSX 中注入
const websiteJsonLd = buildWebSiteJsonLd({ siteName: settings.siteName, searchPath: '/search' })
```

---

## P2 — 补充完善（约 2h）

### P2-1：About 页添加 Person JSON-LD

**问题**：About 页是建立作者权威性（E-E-A-T）的关键页面，添加 `Person` schema 可让 Google 将博主与领域知识关联。

**新建辅助函数**（`src/lib/seo.ts`）：

```ts
export function buildPersonJsonLd({ name, url, image, description, sameAs }: {
  name: string; url: string; image?: string; description?: string; sameAs?: string[]
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name, url,
    image: image || undefined,
    description: description || undefined,
    sameAs: sameAs?.length ? sameAs : undefined,
  }
}
```

`sameAs` 数组可放 GitHub、Twitter 等个人主页 URL。

---

### P2-2：About 页添加 `<link rel="me">` 验证标签

**问题**：`rel="me"` 允许社交平台（Mastodon、IndieWeb 等）验证博主身份，建立可信的作者信息节点。

**改动**：在 About 页 `generateMetadata` 中添加：

```ts
// src/app/(public)/about/page.tsx
export async function generateMetadata() {
  return {
    ...buildPageMetadata(...),
    // 添加 rel="me" links
    alternates: {
      canonical: '...',
      // Next.js 暂不直接支持 rel="me"，用 other 字段
    },
    other: {
      'link:me:github': 'https://github.com/RoyDust',
    },
  }
}
```

或直接在 About 页 JSX 中用 `<link rel="me" href="..." />` 注入。

---

### P2-3：Search Console 站点验证

**问题**：未见 Google / Bing Search Console 验证标签，无法在 Search Console 中提交 sitemap、监控索引状态和搜索表现。

**改动位置**：`src/app/layout.tsx` 的根 metadata 或 `src/lib/seo.ts`。

```ts
// 通过环境变量控制，避免硬编码 token
export const metadata: Metadata = {
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
    // yandex: process.env.YANDEX_SITE_VERIFICATION,
    // other: { 'msvalidate.01': process.env.BING_SITE_VERIFICATION }
  },
}
```

**操作步骤**：
1. 登录 [Google Search Console](https://search.google.com/search-console)
2. 添加属性，选择"HTML 标记"验证方式，获取 content 值
3. 设置 `GOOGLE_SITE_VERIFICATION=...` 环境变量
4. 验证成功后提交 `{siteUrl}/sitemap.xml`

---

### P2-4：Sitemap 补充 `<image:image>` 扩展

**问题**：当前 sitemap 不包含图片信息，Google 图片搜索无法通过 sitemap 发现博文封面图。

**改动位置**：`src/app/sitemap.ts`（需扩展 post 查询加上 `coverImage` 字段）

> **注意**：Next.js `MetadataRoute.Sitemap` 类型目前不原生支持 `<image:image>` 扩展，需改成返回 `Response` 并手写 XML 或使用 `next-sitemap` 库。成本较高，可推迟到 P3。

---

## P3 — 长期优化

| 项目 | 说明 | 成本 |
|------|------|------|
| **FAQ schema** | 针对技术类文章注入 FAQ schema，提升富文本片段展示概率 | 高（需人工标记） |
| **sitemap 图片扩展** | 在 sitemap 条目中加入 `<image:image>` 子节点 | 中（需自定义 XML 生成） |
| **hreflang** | 如果未来支持双语，现在可预留 `alternates.languages` 字段 | 低（架构决策） |
| **Core Web Vitals 监控** | 接入 Vercel Analytics 或 web-vitals 上报 LCP/CLS/INP | 中 |
| **IndexNow 协议** | 新文章发布时主动推送到 Bing/Yandex，缩短收录延迟 | 低（加一个 API route） |
| **规范化重定向** | 确保 `www` → non-www、`http` → `https` 在 next.config 中声明 | 低 |

---

## 实施顺序建议

```
Week 1（P0）
├── P0-1: seo.ts images 加 width/height/type     ← 改 1 个函数，影响全站
├── P0-2: buildArticleMetadata 加 authors 字段   ← 改 1 个函数 + 1 个调用点
└── P0-3: images 加 alt 文本                     ← 同上，顺带完成

Week 2（P1 前半）
├── P1-1: 分类/标签/系列详情页 OG 图片           ← 新建 3 个 opengraph-image.tsx
└── P1-2: 分类/标签/系列详情页 BreadcrumbList    ← 改 3 个 page.tsx，每个 ~10 行

Week 3（P1 后半 + P2）
├── P1-3: 首页 WebSite JSON-LD + SearchAction    ← 新增 buildWebSiteJsonLd 函数
├── P2-1: About 页 Person JSON-LD               ← 新增 buildPersonJsonLd 函数
├── P2-3: Search Console 验证                   ← 环境变量 + 提交 sitemap
└── P2-2: rel="me" 验证标签                     ← About 页小改动

P3（视优先级排期）
```

---

## 验证清单

每个阶段完成后，使用以下工具验证：

| 工具 | 验证项 |
|------|--------|
| `pnpm vitest run` | 确保 seo.test.ts 全部通过 |
| [Rich Results Test](https://search.google.com/test/rich-results) | 检查文章页 BlogPosting、BreadcrumbList schema |
| [OpenGraph.xyz](https://www.opengraph.xyz) | 检查 OG 图片、title、description 展示 |
| [Twitter Card Validator](https://cards-dev.twitter.com/validator) | 检查 Twitter 卡片渲染 |
| Google Search Console → URL 检查 | 确认 Googlebot 能抓取并渲染页面 |
| `curl {siteUrl}/sitemap.xml` | 确认所有动态路由出现在 sitemap 中 |
| `curl {siteUrl}/robots.txt` | 确认屏蔽规则正确 |

---

## 当前代码基础评估

`src/lib/seo.ts` 的集中式设计是最大优势：所有 P0 改动只需修改辅助函数，自动传播到全站，无需逐页修改。P1 的 OG 图片复用了文章详情页已验证的 `ImageResponse` 方案，字体加载和降级逻辑可直接拷贝，风险极低。

整体而言，现有基础已属行业中上水平，上述改进完成后可达到技术类独立博客的 SEO 最佳实践标准。
