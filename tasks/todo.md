## 系列生成与文章归类

- [x] 确认数据库 schema、现有系列数据与文章总量
- [x] 从文章标题、摘要、分类、标签和正文中抽取主题线索
- [x] 生成系列方案并建立/复用系列记录
- [x] 批量把全部未删除文章归入系列并设置系列内顺序
- [x] 验证每篇文章都有系列、系列计数合理

### Series Draft

- AI 日报：按日期收纳所有 `ai-daily-*` 文章。
- AI 编程与智能体工具：Vibe Coding、Claude Code/OpenClaw、Agent Skills、RAG、AI 发文接口。
- 内容站工程化实战：Next.js 内容站、工程化、性能、API/Prisma、数据库、CI/CD。
- 设计系统与阅读体验：React 组件、设计系统落地、内容页阅读节奏。
- Rust 基础进阶：Rust 泛型与方法等学习笔记。
- 职场与个人反思：非技术职业复盘文章。
- 未整理与测试内容：测试标题、草稿或内容不足文章。

### Review

已基于当前数据库 38 篇未删除文章生成 7 个系列，并通过事务写入 `series`、`posts.seriesId` 和 `posts.seriesOrder`。验证结果：未分类文章数为 0；所有系列内 `seriesOrder` 从 1 开始连续；公开系列页/API 只展示已发布文章，因此未发布测试/草稿不会出现在前台系列详情中。

## Mock 文章处理

- [x] 识别 `scripts/mock-post-catalog.json` 中的 seed/mock 文章
- [x] 识别明显测试占位文章
- [x] 取消发布 mock/测试文章并归入“未整理与测试内容”
- [x] 验证正式系列和公开文章计数

### Mock Review

已处理 12 篇 mock/测试文章：9 篇来自 `scripts/mock-post-catalog.json`，3 篇为明显测试占位（`123123`、`123123123`、`ce-shi-213123`）。处理方式为取消发布、清空 `publishedAt`、归入 `uncategorized-notes`；未硬删除数据库记录。验证结果：公开文章数从 36 降为 26，公开 mock/测试目标数为 0，未分类文章数仍为 0。

## 前台 Fuwari 夜景 UI 改造

- [x] 按 `.omx/plans/blog-homepage-fuwari-bg-fade.png` 建立执行计划
- [x] 将背景控制为页面上方约 2/3，并从上到下渐隐到页面底色
- [x] 重做公开首页导航、侧栏、AI 日报条、最新文章卡片和页脚视觉
- [x] 保留搜索、系列、归档、分类、标签、主题切换和登录入口
- [x] 为前台文章卡片增加风格化本地封面兜底，避免生产模式出现旧错误图
- [x] 完成测试、lint、构建和桌面/移动端生产截图验证

### Front UI Review

已完成前台博客首页改造：默认进入深色夜景阅读界面，顶部居中悬浮导航，左侧作者/分类/标签栏，右侧 AI 日报与最新文章列表。生产截图验证覆盖 `1440x900`、`1920x1080`、`390x844`，均无横向滚动；背景资源命中 `/images/fuwari-night-city-bg.svg`，背景高度为视口约 66%；旧 `/imgs/Error.png` 卡片封面兜底出现次数为 0。

## 前台高分辨率适配

- [x] 复现 2K/4K 视口下主体过窄问题
- [x] 增加高分屏页面宽度、侧栏宽度、主内容卡片列宽适配
- [x] 保持普通桌面和移动端布局不回退
- [x] 重新执行测试、lint、构建和高分辨率截图验证

### High Resolution Review

已针对 `1800px+` 视口增加高分辨率布局适配：页面主体从固定 `61.5rem` 改为 `clamp(61.5rem, 62vw, 76rem)`，导航高分屏宽度提升到 `60rem`，侧栏最高到 `15rem`，主栏文章卡片封面列提升到 `14rem`。生产截图验证覆盖 `1440x900`、`2560x1440` 深色/浅色、`3840x2160` 和 `390x844`；`2560x1440` 下主体宽度从 `984px` 增至 `1216px`，主栏从 `716px` 增至 `924px`，无横向滚动。

## 文章详情主体扩宽

- [x] 复查文章详情页在 2K/4K 下正文区域偏窄的问题
- [x] 为文章详情页单独增加页面宽度、正文宽度和目录栏宽度变量
- [x] 同步真实文章页、文章加载态和文章头图区域的宽度约束
- [x] 修复移动端超长链接造成的横向溢出风险
- [x] 执行文章页测试、lint、构建、全量测试和多视口截图验证

### Article Detail Width Review

已为文章详情页增加独立宽度适配，避免继续受首页主栏宽度约束；`2560x1440` 下文章外壳从约 `824px` 扩至 `1080px`，正文主体从约 `742px` 扩至 `928px`，目录栏保持右侧可读宽度。生产截图验证覆盖 `1440x900`、`2560x1440` 深色/浅色、`3840x2160` 和 `390x844`；移动端无横向滚动，超长链接可正常换行。

## 文章详情右侧目录栏收窄

- [x] 确认左侧 aside 使用 `--rail-width`
- [x] 将右侧文章目录栏宽度改为复用 `--rail-width`
- [x] 增加契约测试防止目录栏回退为独立宽轨道
- [x] 验证 2K 和移动端无横向滚动

### Article TOC Width Review

已将文章详情右侧目录栏从 `20rem-23rem` 的独立宽度收窄为与左侧 aside 相同的 `--rail-width`，即 `clamp(13.75rem, 12vw, 15rem)`。这样 2K/4K 下右侧 aside 与左侧 aside 等宽，正文区域保留前一轮扩宽后的可读宽度。

## 首页左侧 Aside 灰底移除

- [x] 复查首页侧栏灰色底来源
- [x] 首页作用域内去除侧栏整列容器背景、阴影和毛玻璃层
- [x] 保留侧栏卡片自身背景、边框和内容结构
- [x] 增加契约测试并做生产页截图/像素验证

### Home Aside Background Review

已在首页作用域 `reader-home-stage` 下移除左侧 aside 整列灰底：侧栏 rail、`#sidebar`、粘性 taxonomy rail 均强制透明且无阴影/毛玻璃；首页侧栏卡片仅保留自身卡片底与边框，去掉叠加阴影，避免多个卡片阴影连成整列灰色背景。

## 首页侧栏与 AI 日报顶部对齐

- [x] 实测首页侧栏顶部与 AI 日报卡片顶部的高度差
- [x] 将首页侧栏应用与主内容相同的上移量
- [x] 增加契约测试覆盖首页侧栏对齐规则
- [x] 验证桌面与移动端布局无横向滚动

### Home Sidebar Alignment Review

已将首页左侧侧栏与 `AI 日报` 卡片对齐到同一垂直高度。原先首页主内容通过 `.reader-home-stage` 上移约 24-26px，但侧栏未同步；现在首页作用域下的 `.reader-side-rail` 使用同样的 `calc(var(--reader-page-top) * -0.08)` 上移量，使作者资料卡顶部与 `AI 日报` 卡片顶部一致。

## 前台背景图后台可配置

- [x] 复用现有博客站点配置存储，不新增表或迁移
- [x] 增加 `appearance.backgroundImageUrl` 默认值、归一化和校验
- [x] 在后台站点基础设置中增加背景图 URL 输入与预览
- [x] 前台根布局将配置注入 `--reader-background-image`，保持原有 2/3 高度渐隐背景
- [x] 执行针对性测试、lint、build、全量测试和生产页面验证

### Background Config Review

已将前台背景图接入后台“站点基础”配置，字段为 `appearance.backgroundImageUrl`，通过原有 `system_settings` 的 `blog.site` JSON 持久化，不新增迁移。前台根布局会把配置写入 `--reader-background-image`，全局与 `.reader-shell` 背景继续复用原来的 66vh 渐隐层；留空会恢复默认 `/images/fuwari-night-city-bg.svg`。验证已覆盖针对性测试、`lint`、生产构建、全量测试，以及 `1440x900` / `390x844` 生产页面 CSS 变量和横向滚动检查。

## 博客 Motion-first Phase 4-6

- [x] 改造首页 AI 日报、最新文章、精选网格和首页轮播为 Motion-first 编排
- [x] 改造文章列表为 `AnimatePresence mode="popLayout"` 与稳定 wrapper
- [x] 新增 PostCard 外层 motion wrapper，保持卡片业务组件为 RSC
- [x] 改造文章详情 Hero、TOC、继续阅读和订阅表单的辅助动效
- [ ] 清理业务代码里的旧 `.onload-animation`、`stagger-children`、`listAnimation.ts` 和非 shadcn `transition-all`
- [x] 运行针对性测试、lint、旧入口搜索和 build 验证

### Motion-first Phase 4-6 Review

已完成首页、文章列表、PostCard 外层 wrapper 和文章详情辅助动效的 Motion-first 改造，并补充文章列表测试以断言 Motion variants 下 6 篇文章均正常渲染。验证已运行 `pnpm test src/components/blog/__tests__/PostsListingClient.test.tsx`、`pnpm lint`、`pnpm test`、旧入口搜索和 `pnpm build`。旧入口搜索仍命中 `src/styles/animations.css`、layout chrome、taxonomy/about/archives 等页面以及 shadcn 内部 `transition-all`，因此全站旧 `.onload-animation` / `stagger-children` 清理尚未完成。

## SEO 增强计划执行

- [x] P0：补充 OG 图片 `alt` 与文章作者字段，并支持显式声明 `width` / `height` / `type`
- [x] P1：分类、标签、系列详情页新增专属 OG 图片路由
- [x] P1：分类、标签、系列详情页注入 BreadcrumbList JSON-LD
- [x] P1：首页注入 WebSite JSON-LD 与 SearchAction
- [x] P2：About 页注入 Person JSON-LD 与 `rel="me"` 链接
- [x] P2：根 metadata 接入 Search Console 验证环境变量
- [ ] P2/P3：登录 Google/Bing Search Console 完成站点验证并提交 sitemap
- [ ] P3：自定义 sitemap 图片扩展、FAQ schema、IndexNow、规范化 HTTPS 重定向等长期项

## 博客对标优化计划

> 对标 Josh Comeau / Lee Robinson / Overreacted 等优质博客，系统补齐阅读体验、性能、可访问性与内容发现方面的短板。
> 生成日期：2026-05-21　排除项：Web Share API / 平台分享按钮

---

### P0 快速修复（高影响 / 低成本）

#### P0-1 RSS 端点

- [ ] 新建 `src/app/rss.xml/route.ts`
  - `GET /rss.xml`，`export const revalidate = 300`
  - 并发查 `getBlogSettings()` + `prisma.post.findMany`（最新 20 篇已发布，取 title / slug / excerpt / publishedAt / author.name / category.name）
  - 输出 RSS 2.0 XML，`Content-Type: application/xml; charset=utf-8`
  - 内置 `escapeXml()` 转义 `& < > " '`，无需新依赖
  - `<atom:link>` 自引用，`<language>zh-CN</language>`
  - 响应头加 `Cache-Control: public, s-maxage=300, stale-while-revalidate=86400`
- [ ] 验收：`curl /rss.xml` 返回合法 XML；Footer `/rss.xml` 链接不再 404

**影响文件**：新建 1 个文件

---

#### P0-2 图片 Blur Placeholder

- [ ] 新建 `src/lib/image-placeholder.ts`
  - 导出 `shimmerBlurDataURL` 常量（预计算 8×5 px 灰色 SVG 的 base64，零运行时开销）
- [ ] 修改 `src/components/blog/PostCard.tsx` L57-66
  - `FallbackImage` 追加 `placeholder="blur"` + `blurDataURL={shimmerBlurDataURL}`
  - `FallbackImage` 已通过 `...props` 透传所有 `ImageProps`，无需改动该组件
- [ ] 验收：文章列表封面图加载期间显示柔和灰底而非白色空白闪烁

**影响文件**：新建 1 个，修改 1 个

---

#### P0-3 移动端 TOC 抽屉

- [ ] 新建 `src/components/blog/ArticleTocDrawer.tsx`（client 组件）
  - 使用已有 `vaul` 包封装抽屉，内部复用现有 `ArticleToc` 组件
  - 触发按钮：`fixed bottom-20 right-4 xl:hidden z-40`，显示"目录"文字 + 列表图标
  - `headings.length === 0` 时不渲染
  - Drawer 内部：标题栏 + `<ArticleToc headings={headings} />`
- [ ] 修改 `src/app/(public)/posts/[slug]/page.tsx` L322
  - 在 `<BackToTopButton />` 后追加 `<ArticleTocDrawer headings={headings} />`
- [ ] 验收：手机端文章页右下角出现目录按钮；点击弹出抽屉，可点击跳转；xl 及以上不显示

**影响文件**：新建 1 个，修改 1 个

---

### P1 高价值改进（高影响 / 中等成本）

#### P1-1 相关文章

- [ ] 修改 `src/app/(public)/posts/[slug]/page.tsx`
  - 新增 `getRelatedPosts(postId: string, tagSlugs: string[], limit = 3)` 函数
    - `WHERE tags.slug IN [...], id != postId, published = true, deletedAt = null`
    - `ORDER BY publishedAt DESC`，`TAKE 3`
    - 返回：id / title / slug / excerpt / coverImage / createdAt / category
  - `PostPage` 内与 `getContinuationData` 并发调用：`Promise.all([getContinuationData(post), getRelatedPosts(...)])`
  - 插入位置：L426 `<SeriesNav>` 渲染之后
- [ ] 新建 `src/components/blog/ArticleRelatedPosts.tsx`
  - 最多 3 张紧凑卡片（标题 + 摘要 + 分类 + 日期）
  - `posts.length === 0` 时 `return null`
- [ ] 验收：有共同标签的文章在底部"相关文章"区展示；当前文章无标签时区块静默隐藏

**影响文件**：新建 1 个，修改 1 个

---

#### P1-2 代码块行号

- [ ] `pnpm add rehype-highlight-code-lines`（~2 KB，专为 rehype-highlight 配套）
- [ ] 修改 `src/app/(public)/posts/[slug]/page.tsx` L21-22
  - `rehypePlugins` 数组追加 `[rehypeHighlightCodeLines, { showLineNumbers: true }]`
- [ ] 修改 `src/styles/code-highlight.css`
  - 追加 `.code-line` 行样式：`display:block; padding-left:3rem; position:relative`
  - 追加 `.code-line::before`：`content:attr(data-line-number); position:absolute; left:0; width:2.5rem; text-align:right; color:var(--text-faint); font-size:0.75em; user-select:none`
- [ ] 验收：代码块左侧显示行号；行号不可被"全选复制"选中；不影响现有复制按钮功能

**影响文件**：修改 2 个，新增 1 个 npm 依赖

---

#### P1-3 prefers-reduced-motion

- [ ] 修改 `src/styles/animations.css` — 末尾追加
  ```css
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
  ```
- [ ] 修改根 layout（`src/app/layout.tsx`）
  - 引入 `MotionConfig` from `motion/react`
  - 在 `<body>` 内层包裹 `<MotionConfig reducedMotion="user">`
  - `reducedMotion="user"` 自动检测系统偏好，无需手写 media query hook
- [ ] 验收：系统开启"减少动态效果"后所有 Motion 动画瞬间跳过；CSS transition 也同步禁用

**影响文件**：修改 2 个

---

### P2 中等优先级（中等影响 / 低成本）

#### P2-1 ARIA 标注完善

- [ ] 修改 `src/app/(public)/posts/[slug]/page.tsx`，共 4 处单行改动：
  - L466 `<section id="comments">` → 追加 `aria-labelledby="comments-heading"`
  - L467 `<h2>评论</h2>` → 追加 `id="comments-heading"`
  - L478 `<aside data-testid="toc-rail">` → 追加 `aria-label="文章目录"`
  - L485-489 TOC 内容区：外层 `<div>` 改为 `<nav aria-label="本文目录">`，将 `<p>On this page</p>`、`<h3>目录</h3>` 和 `<ArticleToc>` 包裹在内
- [ ] 验收：屏幕阅读器可通过地标导航直接跳转到评论区和目录

**影响文件**：修改 1 个

---

#### P2-2 联系页 /contact

- [ ] 新建 `src/app/(public)/contact/page.tsx`
  - `generateMetadata`：含 title / description，不设 noindex
  - 页面布局：标题区（标题 + 副标题）+ 两列（表单 + 侧边联系信息）
- [ ] 新建 `src/app/(public)/contact/ContactForm.tsx`（client 组件）
  - 使用已有 `react-hook-form` + `zod` 依赖
  - 字段：姓名（可选）、邮箱（必填，zod email）、主题（必填）、内容（必填，min 20 字）
  - 提交方式：构造 `mailto:` URL 打开系统邮件，收件地址读 `process.env.CONTACT_EMAIL`
  - 提交后用已有 `sonner` 显示 toast 提示
- [ ] `.env.example` 追加 `CONTACT_EMAIL=` 说明行
- [ ] 验收：`/contact` 正常渲染；填写并提交后打开邮件客户端且字段预填正确

**影响文件**：新建 2 个，修改 1 个

---

### P3 锦上添花

#### P3-1 热门文章 Widget

- [ ] 新建 `src/app/api/posts/popular/route.ts`
  - 查 `viewCount DESC TAKE 5`，返回 title / slug / viewCount
- [ ] 新建 `src/components/blog/PopularPostsWidget.tsx`
  - 带序号的紧凑列表（序号 + 标题 + 阅读量），无封面
- [ ] 修改 `src/components/layout/Sidebar.tsx`
  - 在现有 `loadTaxonomy` 的 `Promise.all` 中并发加入 `/api/posts/popular`
  - 在"标签"section 之后、阅读统计之前渲染 `<PopularPostsWidget>`
- [ ] 验收：侧栏展示阅读量前 5 文章；数据加载失败时静默隐藏

**影响文件**：新建 2 个，修改 1 个

---

#### P3-2 Series 进度条

- [ ] 修改 `src/components/blog/SeriesNav.tsx` L35-37
  - 在 `{currentIndex + 1} / {posts.length}` 文字下方追加进度条：
    ```tsx
    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-(--reader-border)">
      <div
        className="h-full rounded-full bg-(--accent-warm) transition-[width] duration-300"
        style={{ width: `${Math.round(((currentIndex + 1) / posts.length) * 100)}%` }}
      />
    </div>
    ```
- [ ] 验收：SeriesNav 进度区域出现彩色进度条；第 1 篇约 宽度为 `1/N * 100%`，最后一篇 100%

**影响文件**：修改 1 个

---

#### P3-3 暗模式代码块对比度

- [ ] 修改 `src/styles/code-highlight.css`
  - 在 `html.dark` 作用域下覆盖注释色（当前 `var(--text-muted)` 在暗模式下对比度不足）
  - 确保注释、关键字、字符串等 token 在暗模式背景下达到 WCAG AA（4.5:1）
- [ ] 验收：暗模式代码块各 token 颜色可读，Chrome DevTools 无对比度警告

**影响文件**：修改 1 个

---

### 工作量汇总

| 优先级 | 任务数 | 新建文件 | 修改文件 | 新增依赖 |
|--------|--------|----------|----------|----------|
| P0 | 3 | 2 | 2 | 0 |
| P1 | 3 | 1 | 4 | 1（rehype-highlight-code-lines） |
| P2 | 2 | 3 | 2 | 0 |
| P3 | 3 | 2 | 3 | 0 |
| **合计** | **11** | **8** | **11** | **1** |

---

## 文章详情入场与出场动画

> 让从首页 / `/posts` 点击进入文章详情形成"卡片放大→Hero、主体模块依次入场、右侧目录滑入"的连续动画，并补齐返回时的出场动画。完整实施参考见 `plan/article-transitions.md`。

### 任务清单

- [x] **启用 Next.js 16 View Transitions**
  - 修改 `next.config.ts`：开启 `experimental.viewTransition`
  - 验收：`pnpm dev` 启动正常，无新报错

- [x] **卡片侧标记共享元素名**
  - 修改 `src/components/blog/PostCard.tsx`、`PostCardFeatured.tsx`、`PostCardSecondary.tsx`、`HomeLatestPosts.tsx`：封面入口与主标题 `h2/h3` 加 `style={{ viewTransitionName: 'post-cover-${slug}' }}` / `post-title-${slug}`
  - 验收：DOM 上能查到对应内联样式,且页内同 slug 唯一

- [x] **详情页 Hero 标记同名共享元素**
  - 修改 `src/components/blog/ArticleHero.tsx`:新增 `slug` prop；外层 `motion.header` 加 `viewTransitionName: 'post-cover-${slug}'`，`h1` 加 `post-title-${slug}`
  - 修改 `src/app/(public)/posts/[slug]/page.tsx`：把 `post.slug` 传给 `ArticleHero`
  - 验收：点击列表卡片进入详情，封面与标题从卡片位置插值放大到 Hero 位置

- [x] **主体模块 stagger 入场**
  - 新建 `src/components/blog/ArticleSectionsReveal.tsx`：client component，`motion.div variants={listContainerVariants}` 包装 children
  - 修改 `src/app/(public)/posts/[slug]/page.tsx`：把主列的 `<article>`、`<SeriesNav>`、`<ArticleRelatedPosts>`、读后操作、Newsletter、评论区作为 `ArticleSectionsReveal` 的 children，并各自外包一层 `ArticleSection`
  - 验收：进入详情页时，各 section 自上而下以 ~60ms 间隔淡入上移

- [x] **右侧目录滑入**
  - 新建 `src/components/blog/ArticleTocRail.tsx`：client component，包当前 `<aside>`，初始 `{opacity:0, x:16}` → `{opacity:1, x:0}`，`delay: 0.25`
  - 修改 `src/app/(public)/posts/[slug]/page.tsx`：用 `ArticleTocRail` 替换原 aside
  - 验收：Hero 共享元素到位后约 250ms，目录从右侧滑入并淡入

- [x] **出场动画升级**
  - 修改 `src/components/layout/PageTransition.tsx`：包 `AnimatePresence mode="wait"`，沿用 `revealVariants` 的 hidden/visible/exit
  - 验收：返回列表 / 切换页面时，旧页面向上淡出再渲染新页面

- [x] **reduced-motion 兜底**
  - `ArticleSectionsReveal` / `ArticleTocRail` / `PageTransition` 使用 `useReducedMotion()`，命中时直接渲染静态结构
  - 在 `src/app/globals.css` 增加 `@media (prefers-reduced-motion: reduce) { ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; } }`
  - 验收：开启系统"减少动效"后，所有动画被静态替换

- [x] **跨页面骨架占位（防共享元素错位）**
  - 改造 `src/app/(public)/posts/[slug]/loading.tsx`：渲染封面 / 标题骨架；不在骨架上加 `viewTransitionName`，避免卡片插值目标落到骨架节点
  - 验收：慢网下点击卡片，骨架直接"接住"共享元素，不会回弹到原位

- [x] **自定义 View Transition 曲线**
  - `src/app/globals.css` 增加全局 `::view-transition-group(*)` / old / new 曲线、时长覆盖，避免使用不受 CSS 语法支持的 slug 通配选择器
  - 验收：实测过渡时长接近 380ms，曲线为 `cubic-bezier(0.22, 1, 0.36, 1)`

- [x] **测试与回归**
  - 新增 `src/components/blog/__tests__/ArticleSectionsReveal.test.tsx`：断言子节点正常渲染
  - 跑 `pnpm test`、`pnpm lint`、`pnpm build`
  - 浏览器矩阵手测：当前环境用 Playwright Chromium 覆盖完整 DOM / reduced-motion 流程；Firefox / WebKit 浏览器二进制未安装，未做真机矩阵
  - 验收：现有 723 测试 + 1 新测试全部通过；Chromium 无控制台报错

### 验收（整体）

1. 从首页 / `/posts` 点击任意文章卡片进入详情，封面与标题从卡片位置放大到 Hero
2. Hero 到位后，正文 / SeriesNav / 相关文章 / 读后操作 / 评论各 section 自上而下 stagger 淡入
3. 右侧目录从右滑入并淡入
4. 返回列表时，详情页内容向上淡出再切换
5. `prefers-reduced-motion` 开启时全部动画跳过且无残影
6. Firefox 等不支持的浏览器静默降级为现有切换效果，不报错

**影响文件**：新建 3 个（`ArticleSectionsReveal.tsx`、`ArticleTocRail.tsx`、新测试文件），改造 1 个加载态（`loading.tsx`），修改约 8 个既有文件（`next.config.ts`、3 个卡片组件、`HomeLatestPosts.tsx`、`ArticleHero.tsx`、`page.tsx`、`PageTransition.tsx`、`globals.css` 等）

**新增依赖**：无（复用现有 `motion/react`、Next.js 16 内置 View Transitions）

### Review

已完成文章详情入场与出场动画实施：Next 16 `experimental.viewTransition` 已启用，首页/列表文章入口与详情 Hero 使用同名 `viewTransitionName`；详情页主体改为 `ArticleSectionsReveal` + `ArticleSection` stagger 入场，右侧目录改为 `ArticleTocRail` 延迟滑入，`PageTransition` 增加挂载后 exit 动画并规避 hydration mismatch。已有 `loading.tsx` 已改造成文章详情慢网骨架，但按计划正文说明未给骨架加共享元素名，避免共享元素目标落到临时骨架。

验证结果：`pnpm lint` 通过；`pnpm test` 通过 207 个测试文件 / 724 个测试；`pnpm build` 通过且构建输出确认 `viewTransition` experiment 已启用；Playwright Chromium 已验证首页入口 `post-cover-*` 到详情 Hero、`post-title-*` 到详情 H1 名称匹配，桌面 TOC 可见，`prefers-reduced-motion: reduce` 下 TOC `opacity=1` 且 `transform=none`。补充修复了导航栏样式契约测试中缺失 `var(--accent-sky)` token 的最小差异。

剩余风险：当前机器已有 3000 端口 dev 服务，3001 因 `.next/dev/lock` 未另启；Firefox / WebKit / Safari 真机矩阵未执行（本机 Playwright 只安装了 Chromium）。Lighthouse 性能分未跑。

### Review 补充：头部宽度动画

修正了头部宽度变化未变慢的问题：实际导航宽度由 `.reader-nav` 的 `max-width: var(--page-width)` 控制，因此补充 `reader-nav-frame` 命名 View Transition，并将布局宽度动画时长收敛到 `--reader-route-layout-duration: 1800ms`。同时调整命名 View Transition 规则顺序，确保 `reader-nav-frame` / `reader-layout-frame` 的慢速规则覆盖通配 `old/new(*)` 规则。

### Review 补充：右侧目录重载动画

修正右侧目录的动效方向：移除 `ArticleTocRail` 的右侧滑入动画，改为原地骨架态到内容态的 layout 高度重载。目录卡片先显示列表骨架，再根据真实标题数量纵向增高或缩短并淡入内容，避免把目录理解成从页面右侧进入的新模块。

## AI 辅助生成文章功能完善计划

> 生成日期：2026-05-24
> 范围：后台文章编辑器里的“一键 AI 生成文章信息”和“AI 辅助”相关任务流。
> 原则：保留标题和正文不被一键覆盖；优先修正任务语义、失败恢复和覆盖安全，再做体验增强。

### 现状结论

- [x] 一键生成已接入 `/api/admin/ai/actions/article-info`，任务类型为 `post-article-info`
- [x] 一键生成会保留标题和正文，仅回填 slug、摘要、SEO 描述、分类、标签
- [x] AI 辅助入口已收拢为弹窗，主编辑布局不再长期占用右侧空间
- [x] 任务中心已有 `post-article-info` 基础展示标签
- [ ] 一键生成仍在单个请求里串行执行 5 个 AI 动作，存在耗时和整体失败风险
- [ ] 表单已回填的结果，在任务中心里仍可能显示为“未应用”
- [ ] 草稿一键生成任务缺少专用恢复/重试语义，现有批处理 runner 对无 `postId` 项会跳过
- [ ] 单项标题、slug、分类、标签生成仍走 `/api/admin/posts/metadata`，未完全进入任务中心

### P0：可靠性与任务语义

- [ ] 改造一键生成执行方式
  - 方案 A：创建任务后异步执行，前端轮询任务详情，任务完成后回填组合结果
  - 方案 B：保持同步请求，但允许部分成功字段回填，并明确展示失败字段
  - 推荐先做方案 B，影响面较小；后续再升级为方案 A
- [ ] 对 `post-article-info` 增加组合结果语义
  - 在任务 metadata 或输出中保存最终 `articleInfo`
  - 任务详情页优先展示组合后的 slug、摘要、SEO 描述、分类、标签
- [ ] 修正“一键生成已回填但任务项未应用”的状态
  - 草稿模式：标记为“已回填到表单”，不显示落库应用按钮
  - 编辑模式：明确区分“已回填表单”和“已应用到数据库”
- [ ] 修复草稿任务重试/恢复
  - 对无 `postId` 的草稿任务，基于 `inputSnapshot` 执行专用 retry runner
  - 或在任务详情中禁用草稿失败项重试，并说明“请回到编辑器重新生成”
- [ ] 增加回归测试
  - 一键生成部分失败时返回已成功项
  - 草稿任务不会被批处理恢复错误标记为 `SKIPPED`
  - 已回填任务项不会在任务详情误导用户重复应用

### P1：编辑体验与覆盖安全

- [ ] 增加一键生成预览确认
  - 展示即将替换的字段：slug、摘要、SEO 描述、分类、标签
  - 对 slug、分类、标签这类影响路由或归档的字段给出更明显提示
- [ ] 增加差异视图
  - 当前值为空：显示“将补全”
  - 当前值已有内容：显示“将替换”
  - 标签支持新增/移除差异展示
- [ ] 成功后展示任务入口
  - 一键生成成功 toast 或卡片状态里提供“查看 AI 任务”
  - 方便从编辑器追溯模型输出和失败原因
- [ ] 强化字段质量校验
  - slug 做唯一性预检查或保存前冲突提示
  - SEO 描述增加长度区间提示
  - 标签数量设置合理上限，避免生成过多弱相关标签
  - 分类/标签低置信度时只展示建议，不强制覆盖

### P2：统一 AI 任务中心能力

- [ ] 逐步迁移单项 AI 生成入口
  - 标题、slug、分类、标签从 `/api/admin/posts/metadata` 迁移到 `/api/admin/ai/actions`
  - 保留旧接口一段时间作为兼容层，避免一次性大改
- [ ] 统一任务记录字段
  - 记录 action、modelId、inputSnapshot、output、applied/formApplied、失败原因
  - 任务详情页按任务类型渲染更友好的输出，而不是只展示 JSON 字符串
- [ ] 统一 AI 辅助弹窗与一键生成的文案
  - 一键生成：面向“批量替换文章信息”
  - AI 辅助：面向“单项建议与人工选择”
  - 避免用户误以为两者是重复按钮
- [ ] 更新接口目录
  - 同步 `src/lib/ai-interface-catalog.ts` 中的请求/响应说明
  - 标明哪些接口会落库、哪些只回填表单

### P3：质量、成本与可观测性

- [ ] 增加生成质量评分
  - slug 可读性、SEO 长度、摘要是否覆盖主题、标签数量和命中率
- [ ] 记录模型与耗时指标
  - 每个 action 记录耗时和使用模型，便于后续优化慢任务
- [ ] 增加 prompt 版本
  - 任务 metadata 记录 promptVersion，方便以后比较生成质量
- [ ] 增加成本保护
  - 内容过短时禁用一键生成
  - 重复点击时复用进行中的任务，避免重复消耗模型额度

### 影响文件预估

- `src/app/api/admin/ai/actions/article-info/route.ts`
- `src/components/posts/hooks/useAiActions.ts`
- `src/components/posts/AdminPostWorkspace.tsx`
- `src/components/admin/ai/AiTaskDetail.tsx`
- `src/components/admin/ai/AiTaskList.tsx`
- `src/lib/ai-batch-jobs.ts`
- `src/lib/ai-post-actions.ts`
- `src/lib/ai-tasks.ts`
- `src/lib/ai-interface-catalog.ts`
- 相关测试：`src/app/api/admin/ai/actions/article-info/__tests__/route.test.ts`、`src/lib/__tests__/ai-batch-jobs.test.ts`、`src/components/admin/ai/__tests__/*`

### 验收标准

- [ ] 一键生成过程中，任意单项失败不会丢弃所有已成功结果
- [ ] 任务中心能准确表达“已生成 / 已回填表单 / 已应用落库”
- [ ] 草稿一键生成任务不会被通用批处理恢复逻辑误处理
- [ ] 编辑器中覆盖已有字段前有明确预览或确认
- [ ] 单项 AI 生成和一键生成在用户心智上有清晰分工
- [ ] 新增/调整逻辑有针对性测试覆盖
- [ ] `pnpm lint` 通过
- [ ] 相关测试通过，必要时补跑 `pnpm test`

### Review

计划已生成，尚未实施代码改动。建议后续按 P0 单独开一组改动和提交，先解决任务可靠性与状态语义，再进入 P1 的交互预览与覆盖保护。

## 后台列表服务端分页修复

- [x] 为后台 `posts/comments/tags` GET 接口增加服务端分页、搜索和必要筛选参数
- [x] 为评论/文章统计改为服务端真实总量，避免被当前页或 100 条上限截断
- [x] 为 `DataTable` 增加服务端分页模式，保留现有客户端分页兼容
- [x] 改造后台文章、评论、标签页面使用接口分页而不是内容分页
- [x] 补充/更新接口与页面回归测试
- [x] 运行相关测试、lint、类型检查

### Review

已将后台评论、文章、标签列表改为接口分页：`comments/posts/tags` GET 支持 `page`、`limit`、搜索参数，评论额外支持 `status`，文章额外支持发布状态筛选。`DataTable` 增加服务端分页模式，页面不再把截断数据或全量数据交给前端内容分页。评论接口去掉开发态错误详情回传；文章轮询摘要任务时只刷新当前服务端分页结果。验证已覆盖针对性测试、全量测试、lint、类型检查和 `git diff --check`。
