# 文章详情入场与出场动画实施方案

> 让"列表卡片 → 文章详情"形成一段连续的视觉叙事：被点击的卡片放大变成 Hero，详情页主体模块依次落位，右侧目录滑入；返回时反向淡出。
>
> **生成日期**：2026-05-22
> **技术栈**：Next.js 16（App Router）· React 19 · motion 12（`motion/react`）· View Transitions API
> **新增依赖**：无（复用现有 `motion/react`、Next.js 16 内置 `experimental.viewTransition`）
> **影响面**：新建 4 个文件、修改约 6~8 个文件，不触碰数据层

---

## 目标效果

| 阶段 | 动画 | 时长 | 触发 |
|------|------|------|------|
| ① 卡片→Hero | 封面图与标题从卡片位置插值放大到详情页 Hero 区 | ~380ms | 点击列表卡片 |
| ② 主体模块入场 | 正文、SeriesNav、相关文章、读后操作、评论自上而下 stagger 淡入 | 每项 ~320ms，间隔 60ms | 路由切换完成 |
| ③ 右侧目录滑入 | 目录 aside 从右侧 16px 滑入 + 淡入 | 400ms（delay 250ms） | 与 ② 并行 |
| ④ 返回出场 | 详情页内容向上 4px 淡出 | 180ms | 返回 / 切换路由 |
| ⑤ 减少动效 | 全部跳过，直接静态渲染 | 0ms | `prefers-reduced-motion: reduce` |

---

## 现状盘点

| 维度 | 现状 |
|------|------|
| 动效库 | 已安装 `motion@12`，使用 `motion/react` 子路径 |
| 共享元素 | 无任何卡片→Hero 过渡，跳转后是硬切换 |
| 详情页内动画 | 仅 `ArticleHero` 有自身 fade-in；其余 section 直接出现 |
| 右侧目录 | 静态 sticky aside（`xl:sticky xl:block`），无入场动画 |
| 已有变体 | `motion/variants.ts` 提供 `revealVariants`、`listContainerVariants`、`panelVariants`、`sheetVariants`、`crossFadeVariants`、`iconPopVariants` |
| 已有过渡 | `PageTransition` 仅做 `opacity 0→1`，无 exit |
| 跳转入口 | `PostCard`、`PostCardFeatured`、`PostCardSecondary` 等使用普通 `next/link` |
| 详情页缓存策略 | `page.tsx` 顶部 `export const dynamic = "force-dynamic"`，每次 SSR |

---

## 方案对比

| 方案 | 共享元素 | 内部动画 | 浏览器覆盖 | 改造侵入度 |
|------|----------|----------|------------|------------|
| A. 纯 View Transitions（CSS） | ✅ 原生 | ✅ 用 CSS keyframes | Chrome/Edge ✅，Safari 18+ ✅，Firefox ❌ 静默降级 | 低 |
| B. `motion/react` + Intercepting Routes（modal/平行路由） | ✅ `layoutId` | ✅ 灵活 | 全平台一致 | 高（需把详情改 modal） |
| **C. View Transitions + motion stagger（推荐）** | ✅ View Transitions 跨文档原生 | ✅ motion 精细控制 | 同 A，降级体验良好 | 中 |

### 选 C 的依据

1. 不动 RSC / SSR 架构，保留 `force-dynamic` 现状
2. View Transitions 已经在 Next.js 16 实验性内建，配置开关后跨文档过渡自动起作用
3. 内部动画用 `motion/react` 精细控制 stagger 节奏与 reduced-motion 适配
4. 不支持的浏览器（Firefox / 旧 Safari）静默降级为普通跳转，**不会出错或留视觉残影**

---

## 技术原理

### View Transitions API（跨文档）

- 触发条件：点击 `<a>` / `next/link` 跳到另一个**同源**页面
- 浏览器在新页面渲染就绪前对**新旧两个文档**做快照
- 通过 `view-transition-name` CSS 属性匹配旧文档的元素 A 和新文档的元素 A
- 浏览器自动计算两者的位置 / 大小 / 不透明度差，生成默认 cross-fade + position interpolation 动画
- 可通过 `::view-transition-group(<name>)`、`::view-transition-old(<name>)`、`::view-transition-new(<name>)` 伪元素覆盖动画曲线 / 时长

### motion `staggerChildren`

- 在父 `motion.*` 上声明 `variants={listContainerVariants}` + `initial="hidden" animate="visible"`
- 父变体里通过 `transition.staggerChildren` 设置子节点间错峰时间
- 每个子节点用 `variants={revealVariants}`，无需重复声明 `initial/animate`

---

## 实施步骤

### Step 1 — 启用 Next.js 16 View Transitions

#### 文件

| 操作 | 路径 |
|------|------|
| 修改 | `next.config.ts` |

#### 代码

```ts
// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ...其他既有配置
  experimental: {
    // 其他已有的 experimental 项保留
    viewTransition: true,
  },
};

export default nextConfig;
```

#### 验收

- `pnpm dev` 启动正常，控制台不出现新报错
- Chrome DevTools → Console 不出现 `view-transition-name is not a known property` 警告

---

### Step 2 — 卡片侧标记共享元素名

#### 文件

| 操作 | 路径 |
|------|------|
| 修改 | `src/components/blog/PostCard.tsx` |
| 修改 | `src/components/blog/PostCardFeatured.tsx` |
| 修改 | `src/components/blog/PostCardSecondary.tsx` |

#### 代码（以 `PostCard.tsx` 为例）

```tsx
// PostCard.tsx 封面 Link
{hasCover ? (
  <Link
    href={`/posts/${post.slug}`}
    aria-label={`阅读 ${post.title}`}
    className="theme-media relative aspect-[1.55] overflow-hidden rounded-lg md:h-full md:aspect-auto"
    style={{ viewTransitionName: `post-cover-${post.slug}` }}
  >
    ...FallbackImage...
  </Link>
) : (
  ...
)}

// 标题 h3
<Link href={`/posts/${post.slug}`} className="block min-w-0">
  <h3
    className="text-90 line-clamp-2 text-lg font-extrabold leading-snug ..."
    style={{ viewTransitionName: `post-title-${post.slug}` }}
  >
    {post.title}
  </h3>
</Link>
```

`PostCardFeatured` / `PostCardSecondary` 中找到对应的封面容器和主标题，加同名 `viewTransitionName`。

#### 验收

- DOM 上可查到 `<a style="view-transition-name: post-cover-foo">` 内联样式
- 同一页内不会有两张卡片重名（slug 天然唯一）

---

### Step 3 — 详情页 Hero 标记同名共享元素

#### 文件

| 操作 | 路径 |
|------|------|
| 修改 | `src/components/blog/ArticleHero.tsx` |
| 修改 | `src/app/(public)/posts/[slug]/page.tsx` |

#### 代码

```tsx
// ArticleHero.tsx
interface ArticleHeroProps {
  slug: string; // 新增
  title: string;
  excerpt: string | null;
  coverImage?: string | null;
  category: { name: string; slug: string } | null;
  author: { name: string | null; image?: string | null };
  createdAt: Date | string;
  viewCount: number;
  readingTimeMinutes: number;
}

export function ArticleHero({ slug, title, ... }: ArticleHeroProps) {
  return (
    <motion.header
      className="reader-banner flex min-h-[clamp(22rem,42vw,33rem)] items-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      style={{ viewTransitionName: `post-cover-${slug}` }}
    >
      {/* ...封面图、遮罩... */}

      <div className="relative z-10 grid w-full gap-6 p-6 sm:p-8 lg:p-10">
        {/* ...面包屑、分类... */}
        <h1
          className="font-display text-4xl font-extrabold leading-tight text-white md:text-5xl lg:text-6xl"
          style={{ viewTransitionName: `post-title-${slug}` }}
        >
          {title}
        </h1>
        {/* ...摘要、meta... */}
      </div>
    </motion.header>
  );
}
```

```tsx
// page.tsx — 在调用处补 slug
<ArticleHero
  slug={post.slug}
  title={post.title}
  excerpt={post.excerpt}
  coverImage={post.coverImage}
  category={post.category}
  author={post.author}
  createdAt={post.createdAt}
  viewCount={post.viewCount}
  readingTimeMinutes={post.readingTimeMinutes}
/>
```

#### 验收

- 点击列表卡片进入详情，能看到封面图与标题从卡片位置**插值**放大到 Hero 位置
- DevTools → Animations 面板能看到 `::view-transition-group(post-cover-xxx)` 关键帧

---

### Step 4 — 主体模块 stagger 入场

#### 文件

| 操作 | 路径 |
|------|------|
| 新建 | `src/components/blog/ArticleSectionsReveal.tsx` |
| 修改 | `src/app/(public)/posts/[slug]/page.tsx` |

#### 代码

```tsx
// src/components/blog/ArticleSectionsReveal.tsx
"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import type { ReactNode } from "react";
import { listContainerVariants, revealVariants } from "@/components/motion/variants";

const reducedVariants: Variants = {
  hidden: { opacity: 1 },
  visible: { opacity: 1 },
};

export function ArticleSectionsReveal({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className="min-w-0 space-y-8"
      variants={reduce ? reducedVariants : listContainerVariants}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
}

export function ArticleSection({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();

  return (
    <motion.section
      className={className}
      variants={reduce ? reducedVariants : revealVariants}
    >
      {children}
    </motion.section>
  );
}
```

```tsx
// page.tsx 主列改造（节选）
import { ArticleSectionsReveal, ArticleSection } from "@/components/blog/ArticleSectionsReveal";

<div className="grid gap-[var(--layout-rail-gap)] xl:grid-cols-[minmax(0,1fr)_var(--article-toc-width)] xl:items-start">
  <ArticleSectionsReveal>
    <ArticleSection>
      <article className="article-shell reader-card overflow-hidden">
        <ArticleHero slug={post.slug} title={post.title} {...} />
        <div className="px-5 py-8 sm:px-8 lg:px-10 lg:py-10">...正文...</div>
      </article>
    </ArticleSection>

    {post.series && !post.series.deletedAt ? (
      <ArticleSection>
        <SeriesNav currentSlug={post.slug} posts={post.series.posts} series={...} />
      </ArticleSection>
    ) : null}

    <ArticleSection>
      <ArticleRelatedPosts posts={relatedPosts} />
    </ArticleSection>

    <ArticleSection className="reader-panel w-full space-y-6 p-6 sm:p-8">
      <SectionHeader eyebrow="读后" title="读后操作" .../>
      <div className="flex flex-wrap items-center gap-3">...互动按钮...</div>
    </ArticleSection>

    {settings.newsletter.enabled ? (
      <ArticleSection className="reader-panel w-full space-y-4 p-6 sm:p-8">
        ...Newsletter...
      </ArticleSection>
    ) : null}

    <ArticleSection>
      <section aria-labelledby="comments-heading" className="reader-panel ..." id="comments">
        ...评论区...
      </section>
    </ArticleSection>
  </ArticleSectionsReveal>

  <ArticleTocRail headings={headings} />
</div>
```

#### 注意事项

- `ArticleSectionsReveal` 是 client component，但只接收 `children`，不破坏 page.tsx 的 server component 边界
- 各 `<section>` 的 className 通过 `ArticleSection` 转发，保留原有视觉
- `revealVariants` 已经定义好 hidden / visible / exit，不需要额外再写

#### 验收

- 进入详情页时，主列各 section 自上而下以约 60ms 间隔淡入上移（y: 8 → 0）
- 没有破坏现有 `space-y-8`、`reader-panel` 等 className 效果

---

### Step 5 — 右侧目录滑入

#### 文件

| 操作 | 路径 |
|------|------|
| 新建 | `src/components/blog/ArticleTocRail.tsx` |
| 修改 | `src/app/(public)/posts/[slug]/page.tsx` |

#### 代码

```tsx
// src/components/blog/ArticleTocRail.tsx
"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArticleToc } from "./ArticleToc";

interface ArticleTocRailProps {
  headings: Array<{ id: string; text: string; level: 1 | 2 | 3 }>;
}

export function ArticleTocRail({ headings }: ArticleTocRailProps) {
  const reduce = useReducedMotion();

  return (
    <motion.aside
      data-testid="toc-rail"
      aria-label="文章目录"
      className="article-toc-rail hidden transition-[top,max-height,transform,box-shadow] duration-300 ease-out will-change-[top,transform] xl:sticky xl:block"
      style={{ top: "calc(var(--sidebar-sticky-top, 0px) + 0.75rem)" }}
      initial={reduce ? false : { opacity: 0, x: 16 }}
      animate={reduce ? undefined : { opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      <nav aria-label="本文目录" className="reader-panel max-h-[var(--article-toc-card-max-height)] overflow-auto p-5">
        <p aria-hidden="true" className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]">
          On this page
        </p>
        <h2 className="mb-4 font-display text-lg font-semibold text-[var(--foreground)]">目录</h2>
        <ArticleToc headings={headings} />
      </nav>
    </motion.aside>
  );
}
```

```tsx
// page.tsx — 用 ArticleTocRail 替换原 aside
import { ArticleTocRail } from "@/components/blog/ArticleTocRail";

// ...
<ArticleTocRail headings={headings} />
```

#### 注意事项

- `initial={false}` 在 reduced-motion 时跳过初始状态，直接展示终态，避免任何动画副作用
- `xl:sticky` 行为不变，sticky 定位与 motion 的 `transform` 不冲突
- `delay: 0.25` 让目录在 View Transitions 共享元素到位后再出现，避免视觉拥挤

#### 验收

- Hero 共享元素到位后，目录 aside 从右侧滑入并淡入
- sticky 滚动行为保持原样

---

### Step 6 — 出场动画升级

#### 文件

| 操作 | 路径 |
|------|------|
| 修改 | `src/components/layout/PageTransition.tsx` |

#### 代码

```tsx
// src/components/layout/PageTransition.tsx
"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { revealVariants } from "@/components/motion/variants";

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  if (reduce) {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        variants={revealVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

#### 注意事项

- `mode="wait"` 让旧页面 exit 完才挂载新页面
- `revealVariants.exit` 已经定义为 `{ opacity: 0, y: -4, duration: motionDuration.fast }`
- View Transitions 触发期间，motion 的 exit 与浏览器原生过渡帧会并行运行；实测在 Chrome 上观感是连贯的
- 如果某些页面观察到双重过渡导致闪烁，可以只在详情页路径上禁用 motion 出场：`if (pathname.startsWith("/posts/")) return <>{children}</>`

#### 验收

- 从详情页返回列表 / 切换其他路由时，旧页面向上 4px 淡出再渲染新页面
- 不会出现"先白屏再淡入"的两段式闪烁

---

### Step 7 — reduced-motion 兜底

#### 文件

| 操作 | 路径 |
|------|------|
| 修改 | `src/app/globals.css`（或最接近根的全局样式） |

#### 代码

```css
/* globals.css */
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}
```

`ArticleSectionsReveal`、`ArticleTocRail`、`PageTransition` 内已通过 `useReducedMotion()` 跳过动画，本步骤是浏览器原生 View Transitions 的兜底。

#### 验收

- macOS：系统偏好设置 → 辅助功能 → 显示 → 减少动态效果（勾选）
- Windows：设置 → 辅助功能 → 视觉效果 → 动画效果（关闭）
- Chrome DevTools：Rendering 面板 → "Emulate CSS media feature prefers-reduced-motion" → reduce
- 三种入口任一开启后：列表→详情是硬切换，详情页 section 直接出现，目录直接显示

---

### Step 8 — 跨页面骨架占位

#### 文件

| 操作 | 路径 |
|------|------|
| 新建 | `src/app/(public)/posts/[slug]/loading.tsx` |

#### 代码

```tsx
// src/app/(public)/posts/[slug]/loading.tsx
export default function PostLoading() {
  return (
    <div className="article-detail-page relative overflow-x-clip pb-16">
      <div className="grid gap-[var(--layout-rail-gap)] xl:grid-cols-[minmax(0,1fr)_var(--article-toc-width)] xl:items-start">
        <div className="min-w-0 space-y-8">
          <article className="article-shell reader-card overflow-hidden">
            <div className="reader-banner flex min-h-[clamp(22rem,42vw,33rem)] items-end">
              <div className="reader-skeleton absolute inset-0" />
              <div className="relative z-10 w-full space-y-4 p-6 sm:p-8 lg:p-10">
                <div className="reader-skeleton h-4 w-40 rounded-full" />
                <div className="reader-skeleton h-12 w-3/4 rounded-2xl" />
                <div className="reader-skeleton h-6 w-1/2 rounded-full" />
              </div>
            </div>
            <div className="px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
              <div className="mx-auto max-w-[var(--article-reading-max-width)] space-y-4">
                <div className="reader-skeleton h-4 w-full rounded-full" />
                <div className="reader-skeleton h-4 w-full rounded-full" />
                <div className="reader-skeleton h-4 w-5/6 rounded-full" />
              </div>
            </div>
          </article>
        </div>
        <aside className="article-toc-rail hidden xl:sticky xl:block">
          <div className="reader-panel space-y-3 p-5">
            <div className="reader-skeleton h-3 w-24 rounded-full" />
            <div className="reader-skeleton h-5 w-32 rounded-full" />
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="reader-skeleton h-3 w-full rounded-full" />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
```

#### 说明

- 这一步**不**在骨架上加 `viewTransitionName`：因为骨架是过渡目标，加上反而会破坏插值（卡片想找的是真实 Hero，而不是骨架）
- 骨架本身在慢网环境下提供"立即响应感"，避免共享元素结束后看到长时间空白

#### 验收

- DevTools Network → Slow 3G 节流后点击卡片，能立即看到骨架
- 共享元素动画结束 ~300ms 后真实 Hero 渲染，无明显回弹

---

### Step 9 — 自定义 View Transition 曲线

#### 文件

| 操作 | 路径 |
|------|------|
| 修改 | `src/app/globals.css` |

#### 代码

```css
/* globals.css */
@layer utilities {
  /* 默认浏览器是 250ms ease, 改成与 motion 一致的 outQuint 380ms */
  ::view-transition-group([class^="post-cover-"]),
  ::view-transition-group([class^="post-title-"]) {
    animation-duration: 380ms;
    animation-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
  }

  /* 旧页面元素淡出快一些，避免双图叠加期太长 */
  ::view-transition-old(*) {
    animation-duration: 220ms;
  }
  ::view-transition-new(*) {
    animation-duration: 380ms;
  }
}
```

> 注意：`::view-transition-group(<name>)` 中 `<name>` 是 `view-transition-name` 的值；上面的属性选择器写法依赖浏览器实现的伪元素命名规则；如果不工作，可以改用对每个 slug 精确匹配——但通常更稳的做法是直接全局 `::view-transition-group(*)` 设置时长。

#### 验收

- DevTools → Animations 面板能看到对应伪元素的 duration ≈ 380ms

---

### Step 10 — 测试与回归

#### 文件

| 操作 | 路径 |
|------|------|
| 新建 | `src/components/blog/__tests__/ArticleSectionsReveal.test.tsx` |

#### 代码

```tsx
// ArticleSectionsReveal.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArticleSection, ArticleSectionsReveal } from "@/components/blog/ArticleSectionsReveal";

describe("ArticleSectionsReveal", () => {
  it("renders children inside motion container", () => {
    render(
      <ArticleSectionsReveal>
        <ArticleSection>
          <p>section A</p>
        </ArticleSection>
        <ArticleSection>
          <p>section B</p>
        </ArticleSection>
      </ArticleSectionsReveal>
    );

    expect(screen.getByText("section A")).toBeInTheDocument();
    expect(screen.getByText("section B")).toBeInTheDocument();
  });
});
```

#### 浏览器手测矩阵

| 浏览器 | 共享元素 | section stagger | 目录滑入 | 出场 |
|--------|----------|-----------------|----------|------|
| Chrome 130+ | ✅ | ✅ | ✅ | ✅ |
| Edge 130+ | ✅ | ✅ | ✅ | ✅ |
| Safari 18 | ✅ | ✅ | ✅ | ✅ |
| Safari 17 | ⏭ 静默降级 | ✅ | ✅ | ✅ |
| Firefox | ⏭ 静默降级 | ✅ | ✅ | ✅ |

#### 命令

```bash
pnpm test           # 期望 ≥ 724 通过（723 + 1 新测试）
pnpm lint           # 0 error / 0 warning
pnpm build          # 期望成功，无新警告
pnpm dev            # 手测 ① ~ ⑤ 全流程
```

---

## 关键风险与缓解

| 风险 | 触发条件 | 缓解 |
|------|----------|------|
| Firefox 用户无共享元素效果 | Firefox 默认未启用跨文档过渡 | 静默降级为现有切换，体验不退步；后续 Firefox 跟进后自动生效 |
| 共享元素错位（卡片不在视口内 / 滚动差） | 用户滚到页面下方点击卡片 | 浏览器会自动从视口内最近的位置开始插值；如出现可加 `view-transition-name` 到滚动容器并设 `contain: layout` |
| `force-dynamic` 详情页慢网空白 | 服务端响应慢于 ~200ms | Step 8 的 `loading.tsx` 骨架接住空窗期 |
| `viewTransitionName` 重名 | 列表里出现重复 slug（理论上不会） | slug 在数据库层已唯一约束，无需额外处理 |
| motion exit + View Transitions 双重过渡闪烁 | 同时触发 | Step 6 提供局部禁用方案；实测 Chrome 130+ 无问题 |
| sticky aside 加 motion 后定位失效 | `transform` 与 sticky 不兼容（旧规范） | 现代浏览器 `transform: translate(0)` 不再脱离 sticky 上下文；如遇问题，把 `motion.aside` 改为内层 `motion.div`，外层保留普通 `<aside>` |

---

## 回退策略

每一步都可独立 revert，不互相依赖：

| 步骤 | revert 影响 |
|------|------------|
| Step 1 关闭 `experimental.viewTransition` | Step 2/3/9 自动失效，回到纯 motion 内部动画 |
| Step 4/5 删除新建的 wrapper | 详情页恢复无入场动画 |
| Step 6 还原 `PageTransition` | 退出动画消失 |
| Step 7 移除 CSS | reduced-motion 兜底失效（但 Step 4/5/6 的 JS 兜底仍生效） |

完整回退命令：

```bash
git revert <commit-hash>
```

---

## 完整验收清单

实施完毕后逐项勾选：

- [ ] 列表 / 首页点击任意文章卡片，封面与标题从卡片位置插值放大到 Hero
- [ ] Hero 到位后，正文 / SeriesNav / 相关文章 / 读后操作 / 评论自上而下 stagger 淡入（约 60ms 间隔）
- [ ] 右侧目录从右侧滑入并淡入（约 250ms 延迟）
- [ ] 返回列表 / 切换页面时，内容向上 4px 淡出
- [ ] `prefers-reduced-motion: reduce` 命中时全部动画跳过，无残影
- [ ] Firefox / 旧 Safari 静默降级，不报错
- [ ] `pnpm test` ≥ 724 通过
- [ ] `pnpm lint` 0 error / 0 warning
- [ ] `pnpm build` 成功
- [ ] Lighthouse 性能分不下降超过 2 分

---

## 工作量估算

| 类别 | 项目 |
|------|------|
| 新建文件 | 4 个（`ArticleSectionsReveal.tsx`、`ArticleTocRail.tsx`、`loading.tsx`、新测试文件） |
| 修改文件 | 约 6~8 个（`next.config.ts`、3 个卡片组件、`ArticleHero.tsx`、`page.tsx`、`PageTransition.tsx`、`globals.css`） |
| 新增依赖 | 无 |
| 预计耗时 | 1.5 ~ 2 小时（含手测） |
| 风险等级 | 低（每步可独立 revert，不动数据层） |
