# 前台重设计 · 第二阶段批次 1：文章列表、文章详情、分类 / 标签 / 系列

- 状态：**待确认**（2026-10-20）
- 前置：首页已选定方案 E「发现层下沉」（见 `02-homepage-layout-preserving-proposals.md`），本批次沿用 E 的排版尺度、token 值与交互约定，只做保形优化：每页的骨架、路由、数据层、ISR 策略都不动。
- 范围：`/posts`、`/posts/[slug]`（目录 / 阅读进度 / 系列导航 / 相关推荐 / 读后操作 / 评论区）、`/categories`、`/categories/[slug]`、`/tags`、`/tags/[slug]`、`/series`、`/series/[slug]`。
- 线框：在会话内用 visualize 渲染三张（列表 / 详情 / 分类标签系列），桌面 + 移动，编号圆点对应下文改动清单；未落盘。
- 本阶段不改任何应用代码；本文件是唯一产物。

## 1. 批次共同约定（继承 E）

### 不动的骨架

| 层 | 现状 | 本批处理 |
|---|---|---|
| 页面容器 | `.reader-section` 网格、`--page-width`、xl 左 rail（资料 → 热门 → 分类 → 标签，E 已调序） | 不动 |
| 文章页三栏 | `.reader-shell:has(.article-detail-page)` 把 `--page-width` 放宽到 clamp(76rem, 74vw, 110rem)，左 rail + 正文 + 右目录 rail | 栏位不动，只收窄宽度（见 3.2） |
| 卡片族 | `.reader-panel` / `.reader-card` / `.reader-feed-card` / `.reader-feature-card`，圆角 `--radius-panel` / `--radius-card`，hover 发光 | 全部沿用，只改内部密度 |
| 专题头 | `.reader-banner`（`TaxonomyHero`、系列页 banner、文章 Hero 都基于它） | 保留类名与渐变，收高度、去装饰 |
| 数据与缓存 | 所有页 `revalidate = 300`；`/`、`/posts`、`/archives`、`/series` 在 `PUBLIC_LIST_PATHS`；分类 / 标签 / 系列详情靠 `buildCategoryPath` 等精确失效 | 不动；本批新增的字段都并入现有查询的 `select`，不加往返 |
| 测试契约 | `data-testid="posts-listing"`（E2E 用）、`toc-rail`、`series-progress-bar`、`toc-reload-skeleton`、`post-card-skeleton`；`public-layout-cache.test.ts` 禁止公共布局读 session | 全部保留 |

### 排版尺度（在 02 的表上追加文章页专用行）

| 元素 | 字号 / 行高 | 字体 | 用在 |
|---|---|---|---|
| 页面标题（列表页 h1、专题头 h1） | clamp(1.5rem, 2.6vw, 2rem) / 1.15 | Noto Serif SC 700 | /posts、分类 / 标签 / 系列头 |
| 文章标题（详情 h1） | clamp(1.75rem, 3.2vw, 2.5rem) / 1.2，`text-wrap: balance` | Noto Serif SC 700 | ArticleHero |
| 置顶精选标题 | clamp(1.375rem, 2.4vw, 1.75rem) / 1.25 | Noto Serif SC 700 | PostCardFeatured |
| 区块标题 | 1.125rem / 1.3 | AlibabaPuHuiTi 700 | 「文章 · 111」「相关文章」「评论 (2)」 |
| 列表标题 | 1.0625rem / 1.45 | AlibabaPuHuiTi 500 | PostCard、目录卡名称 |
| 正文段落 | 1.0625rem / 1.85 | AlibabaPuHuiTi 500 | `.reader-prose p` |
| 正文 h2 / h3 | 1.5rem / 1.3 衬线 700；1.1875rem / 1.4 无衬线 700 | — | `.reader-prose` |
| 代码块 | 0.875rem / 1.65 | 等宽（现有） | `.reader-prose pre` |
| 摘要 / 评论内容 | 0.9375rem / 1.7 | AlibabaPuHuiTi 500 | 卡片摘要、评论正文 |
| 目录条目 / 系列条目 | 0.8125rem / 1.5 | AlibabaPuHuiTi 500 | ArticleToc、SeriesNav |
| meta / kicker | 0.75rem，tabular-nums | AlibabaPuHuiTi 500 | 日期、计数、序号 |

### token（沿用 02 的值表，不新增名称；本批只多一处覆盖）

- 02 表中的 `--card-bg`、`--text-body`、`--text-faint`、`--reader-border`、`--reader-background-tint` 全站生效，本批页面自动受益。
- 文章页：`.reader-shell:has(.article-detail-page)` 的 `--page-width` 从 clamp(76rem, 74vw, 110rem) 收到 clamp(72rem, 70vw, 96rem)，`--article-reading-max-width` 从 clamp(48rem, 46vw, 58rem) 收到 clamp(42rem, 44vw, 46rem)。理由：中文 1.0625rem 一行 38–42 字最舒适，现状在 1800px 宽屏上一行超过 55 字。
- 专题头：`--reader-banner-height` 从 clamp(11rem, 22vw, 18rem) 收到 clamp(9rem, 16vw, 13rem)，移动端从 clamp(10rem, 44vw, 13rem) 收到 clamp(8rem, 30vw, 10rem)。
- 圆角 / 阴影 / blur：不动。

### 交互通用

- 所有可点元素 `focus-visible` 2px `--accent-sky` 外框 + 2px 偏移（替换现有 `.reader-link:focus-visible` 的 3px 半透明 box-shadow，三处统一）。
- 触控目标 ≥ 44px：Select、筛选按钮、目录条目（移动抽屉内）、评论提交、读后操作按钮。
- 骨架与真实卡片等高，避免 CLS；加载态不用「正在加载…」文字面板，用两张骨架卡。
- 动画沿用 motion 变体与 reduced-motion 处理，不新增。

## 2. 文章列表 `/posts`

### 现状

`posts/page.tsx` 渲染一张页头面板（h1「全部文章」`text-3xl/4xl` + 描述 + `FilterBar`），其下 `PostsListingClient` 用 `useInfinitePosts` 无限滚动；`featured` 文章用 `PostCardFeatured`（最小高 17rem / 20rem 的双栏大卡），其余 `PostCard`。问题：
- 移动端页头面板 = 标题 + 描述 + 两个 Select + 按钮，占满首屏，列表要滚一屏才出现（见 390px 截图）。
- 多篇精选连续出现时整页像轮播，普通卡片反而看不到；首页已经承担精选展示。
- 当前筛选 chips 显示的是 slug（`分类: product-experience`）而非名称。
- `PostCard` 移动端封面整幅 `aspect-[1.55]` 在顶部，一张卡 ≈ 一屏。
- 状态文案：「正在加载下一页...」是文字面板；「已加载全部文章」仅 `totalPages > 1` 时显示；空态无动作。

### 改动清单（编号对应线框圆点）

1. **页头瘦身。** h1 降到页面标题级（clamp(1.5rem, 2.6vw, 2rem) 衬线）；描述改为状态行「共 111 篇 · 按发布时间」，有筛选时追加「· 分类：产品与体验」。数据：`pagination.total` 已返回；名称映射用页面里已经取到的 `getCategoryDirectory()` / `getTagDirectory()`（修掉 slug 显示问题，顺手改 `FilterBar` 的 chips）。
2. **筛选条折叠。** lg+ 保持两个 Select + 「应用筛选」在标题右侧一行（现状），Select 高度 `h-10` → `h-11`。lg 以下改为一行：`<details>` 摘要按钮「筛选」（44px，带当前筛选数角标）+ 当前筛选 chips，展开后才出现两个 Select 与按钮。原生 `details` 不需要 JS，`FilterBar` 仍是 `<form method="get">`。
3. **精选降级为「置顶一张」。** 只有第一页、无筛选、列表第一项是精选时才用 `PostCardFeatured`，最小高 20rem → 15rem，封面列 `0.88fr` → 固定 18rem，标题用置顶精选尺度；其余 `featured` 一律走 `PostCard`，由它已有的「精选」chip 标记。逻辑在 `PostsListingClient` 内判断（`index === 0 && pagination.page === 1 && !filters`），无新数据。
4. **普通卡片对齐首页密度。** `PostCard` 封面列 12rem → 10rem 固定 4:3，内边距 `p-5/6` → `p-4/5`，标题 1.0625rem / 1.45（现 `text-lg md:text-xl`），摘要 0.9375rem / 1.7 `line-clamp-2` 从 sm 起显示，meta 0.75rem tabular；右侧 chevron 列 2rem 保留。移动端封面改到左侧 6.5rem（与首页最新文章一致），卡片高度减半。无封面的文字卡保留 `post-card--text-only` 样式，只同步字号。
5. **状态与骨架。** 首屏骨架 6 → 4，并按第 4 条尺寸重画 `PostCardSkeleton`；加载下一页改为 2 张骨架卡；末尾改「已显示全部 111 篇」+「回到顶部」链接，并在 `totalPages === 1` 时也显示；空态「这个筛选下还没有文章」+「清空筛选」按钮；错误态加「重试」按钮（`useInfinitePosts` 需暴露 `retry`，现状只有 `error` 字符串）。
6. **chips 可逐项移除。** 当前筛选 chips 各自是 `<a>`，指向去掉该项后的 URL（现状只有整体「清空筛选」）；卡片整卡 `focus-within` 外框。

### 数据与缓存

- 无新查询；`FilterBar` 名称映射用页面已有的目录数据。
- `revalidate = 300`、`/posts` 在 `PUBLIC_LIST_PATHS` 中，不动；`/api/posts` 分页接口不动。
- 组件：`posts/page.tsx`、`FilterBar`、`PostsListingClient`、`PostCard`、`PostCardFeatured`、`PostCardSkeleton`、`useInfinitePosts`（加 retry）。

### 权衡

- 精选从「每篇大卡」降为「置顶一张」后，运营给多篇文章打 featured 的效果会被弱化（只剩 chip）。如果希望列表里继续强调多篇精选，可改成「前 3 篇精选用大卡」，成本相同。
- 移动端筛选用 `details` 折叠，展开态没有动画；换 Radix Collapsible 要多一个客户端组件，不建议。
- 工作量 **S+**（6 个组件改样式与少量逻辑，无新查询）。

## 3. 文章详情 `/posts/[slug]`

### 现状

`ArticleHero` 是最小高 clamp(22rem, 42vw, 33rem) 的封面 banner，封面 `opacity-80` 叠两层渐变，面包屑 / 分类 chip / h1（`text-4xl md:text-5xl lg:text-6xl` 白色衬线）/ 摘要 / meta 全放在封面上；正文列 `.reader-prose` 段落 `leading-8`（1rem / 2.0），h2–h5 `mt-12 mb-5`；右侧 `ArticleTocRail`（「On this page」kicker + 「目录」+ 圆点 + 竖线列表），xl 以下用底部右侧浮动「目录」按钮开抽屉，与「回到顶部」按钮上下叠放；正文后依次是 `SeriesNav`（全量列表 + 进度条）、`ArticleRelatedPosts`（三列无封面小卡）、读后操作面板（`SectionHeader` 三行文案 + 4 个按钮）、Newsletter 面板、评论面板。问题：
- 桌面端首屏几乎全是封面，标题压在图上对比度靠渐变硬撑，亮色模式下图片发灰（1440px 截图）。
- 阅读列在宽屏被拉到 58rem，一行超过 55 个汉字。
- 系列导航放在正文之后，读到一半不知道自己在连载第几篇；11 篇全展开占半屏。
- 读后操作面板为了 4 个按钮用了 eyebrow + 标题 + 描述三行。
- 目录圆点 + 竖线 + 激活点在长目录下视觉噪声大；移动端两个浮动按钮叠在右下，和评论提交按钮冲突。

### 改动清单（编号对应线框圆点）

1. **Hero 收紧。** 最小高 clamp(22rem, 42vw, 33rem) → clamp(16rem, 30vw, 22rem)；封面 `opacity-80` → 100%，叠色改为单层自下而上渐变（底部 70% 深色，顶部透明，沿用 `--reader-media-overlay` 的色相），文字只占下半区；面包屑移出 Hero，放在文章卡上方一行（0.8125rem，`--text-faint`）；Hero 内保留分类 chip、h1（文章标题尺度，`text-wrap: balance`）、摘要（1rem / 1.7，`line-clamp-2`）、meta 行（0.8125rem，作者头像 24px + 日期 + 阅读数 + 预计时长）。无封面时高度 clamp(12rem, 20vw, 15rem)，背景用 `--reader-banner-gradient`。封面与 h1 的 `viewTransitionName` 不动。
2. **阅读列与正文排版。** 见第 1 节 token：`--page-width`、`--article-reading-max-width` 收窄；段落 1.0625rem / 1.85，段距 1.25em；h2 1.5rem 衬线 `mt-10 mb-4`，h3 1.1875rem 无衬线 `mt-8 mb-3`，标题 hover 显示 `#` 锚点链接（`scroll-mt-28` 保留）；引用块 `border-l-[3px] var(--accent-warm)` + `--reader-panel-muted` 底；代码块 0.875rem / 1.65，`CopyCodeButton` 保留；`img + em` 视作图注（0.8125rem 居中 `--text-faint`）；标签行 `mt-10 pt-8` → `mt-8 pt-6`。
3. **目录 rail。** 去掉英文 kicker「On this page」；「目录」0.95rem 700（与 rail 面板标题统一）；条目 0.8125rem / 1.5，层级缩进 12px → 10px；激活态用左侧 2px `--accent-sky` 竖条替代圆点 + 竖线（`layoutId` 动画改作用于竖条）；h3 只在其父 h2 激活时展开（用现有 `activeId` 推导，无新状态源）；面板最大高沿用 `--article-toc-card-max-height`；骨架行数 5 → 与标题数一致（最多 8）。
4. **移动端目录与进度。** 「目录」按钮改到底部左侧，与「回到顶部」同一排（都 44px，`bottom-4`），避免遮住评论提交；抽屉条目高 44px；`ReadingProgress` 顶部条 2px → 3px；抽屉标题旁显示「已读 42%」（直接读 `scrollYProgress`，不新增状态）。
5. **系列导航前置。** `SeriesNav` 从正文后移到 Hero 与正文之间，折叠为「连载条」：一行「ListTree 图标 · 系列名 · 第 6 / 11 篇」+ 进度条 + 「上一篇 / 下一篇」文字链接；全量列表收进 `<details>`「展开全部 11 篇」。正文后保留两张「上一篇 / 下一篇」卡（复用 `ArticleContinuation` 的视觉，数据取 `SeriesNav` 已算出的 previous / next）。无系列的文章：可选接入按时间相邻文章（需 2 次 `findFirst`，见数据节）。
6. **相关文章加封面。** 三列卡加顶部 16:9 封面（`getRecommendedPostsForPost` 已返回 `coverImage`），无封面用 `--reader-panel-muted` 底 + 分类名；标题 0.9375rem / 1.45 `line-clamp-2`，分类 chip 0.68rem，日期 0.75rem；移动端单列、封面在左 6.5rem。
7. **读后操作合并为「文末条」。** 去掉 `SectionHeader`，改为一条 56px 高的面板：左侧 点赞 / 收藏 / 分享 三个 44px 圆角按钮带计数（`LikeButton` / `BookmarkButton` / `ShareButton` 不动，只改容器），右侧「写评论」主按钮跳 `#comments`。Newsletter 面板缩为「一句文案 + 单行输入 + 订阅」（复用 `NewsletterForm`），仍受 `settings.newsletter.enabled` 控制。
8. **评论区。** 标题「评论 (2)」区块标题级 + 引导语 0.8125rem 同行右对齐；textarea 最小高 6rem、边框 `--reader-border`、聚焦 2px `--accent-sky`、提交按钮 44px；评论项：头像 32px、名称 0.875rem 700、日期 0.75rem tabular、内容 0.9375rem / 1.7；回复用头像列对齐（`ml-11`）替代 `border-l-2`；空态「还没有评论，来说第一句」+「写评论」按钮聚焦输入框；`CommentListSkeleton` 三条与评论项等高。
9. **骨架同步。** `posts/[slug]/loading.tsx` 的 Hero 高度、正文行数、目录骨架按 1–3 条同步，否则 loading → 页面切换会跳。

### 数据与缓存

- 必需：0 个新查询。相关文章的封面、系列的 previous / next、评论计数都已在现有 `getPost` / `getRecommendedPostsForPost` 返回值里。
- 可选：无系列文章的「上一篇 / 下一篇」需要 2 次 `findFirst`（`createdAt` 前后各一条，`status = PUBLISHED`，`deletedAt = null`），并入 `Promise.all`；在 300s ISR 内，失效路径不变（新文章发布会失效 `/posts` 与相邻文章路径？不会——相邻关系变化时旧文章页要等 ISR 过期，可接受）。
- `revalidate = 300`、`dynamicParams = true`、JSON-LD、`ArticleReadTracker` 不动。
- 组件：`ArticleHero`、`posts/[slug]/page.tsx`（结构与 prose 类）、`ArticleToc` / `ArticleTocRail` / `ArticleTocDrawer`、`ReadingProgress`、`SeriesNav`、`ArticleRelatedPosts`、读后条（新建小组件或内联）、`CommentAuthGate` / `CommentForm` / `CommentList` 样式、`loading.tsx`、`BackToTopButton` 位置。

### 权衡

- Hero 变矮后封面的「海报感」减弱，换来标题可读与首屏见正文；若运营更看重封面，可把阈值放到 clamp(18rem, 34vw, 26rem)。
- 系列导航前置会让有系列的文章正文起点下移约 5rem；折叠后只多一行，可接受。
- 目录 h3 按激活 h2 展开，依赖 IntersectionObserver 的 `activeId`，初始滚动位置在页中时第一帧会全部折叠再展开，有一次布局跳动；可用 `initial={false}` 关掉动画。
- 工作量 **M**（12 个组件改样式，1 个结构移动，0 个必需查询，1 个可选查询）。

## 4. 分类 / 标签 / 系列页

### 现状

- 详情页（分类 / 标签）：`TaxonomyHero`（`.reader-banner` + 装饰 blur 圆 + 三块假楼影 + chip + h1 + 描述 + 统计面板 + 主次两个胶囊按钮）→ `TaxonomyPostGrid`（图标面板「最新 111 篇内容中的近期更新」+ 描述 → `PostCard` 列表）。靠 `?page=` 分页但**没有分页控件**，只有越界时的「回到第一页」。移动端专题头占满一屏（390px 截图）。
- 目录页（分类 / 标签）：`TaxonomyHero` + `TaxonomyDirectoryCard`（名称 2xl 黑体、描述、右侧计数框、底部「进入专题页继续浏览 / 查看内容」行）；分类页是单列网格，4 个分类 = 4 张高卡；标签页两列，标签一多整页极长。
- 系列目录：banner 同风格 + 两列 `SeriesCard`（2.4:1 封面、「连载系列」chip、2xl 标题、描述、「进入系列」）。系列详情：banner + `PostCard` 列表，**没有序号**，看不出阅读顺序。

### 改动清单（编号对应线框圆点）

1. **统一专题头。** `TaxonomyHero` 与系列页 banner 共用一套规格：高度按第 1 节 token 收窄；去掉装饰 blur 圆与假楼影；eyebrow 改中文「分类 / 标签 / 系列」0.75rem（保留 `reader-chip`）；h1 页面标题级衬线；描述 0.9375rem / 1.7 `line-clamp-2`；统计从面板改为 meta 行「111 篇文章 · 最近更新 2026-03-08」（最近更新取详情查询返回的第一篇 `createdAt`，无新查询）；按钮只留一个主按钮（「在列表页中筛选」），次按钮降为文字链接「全部分类 →」。桌面端文字区与操作区左右分布不变。
2. **详情页列表头与分页。** 去掉 `TaxonomyPostGrid` 的图标面板，改为区块标题行「文章 · 111」（`reader-section-heading` 带竖条，与首页统一）+ 右侧「按发布时间」提示；列表用第 2 节第 4 条的 `PostCard` 密度；底部新增 server 渲染分页「← 上一页 · 第 2 / 6 页 · 下一页 →」（`<a href="?page=n">`，ISR 友好，爬虫可达；不改成无限滚动，因为分类页的 `page` 参数已是公开 URL）。`TAXONOMY_PAGE_SIZE` 不动。
3. **分类目录降密度。** `TaxonomyDirectoryCard`：`md:grid-cols-2`（分类页现为单列）；名称 1.125rem / 1.3 700；描述 0.875rem / 1.6 `line-clamp-2`；计数改右上角 0.75rem tabular「111 篇」；去掉底部「进入专题页继续浏览 / 查看内容」行，整卡可点（`<a>` 包卡，内部不再嵌链接）；顶部 4px 色条保留。
4. **标签目录改 chips 云。** `/tags` 不再用卡片，改为一个 `reader-panel` 内的 chips 云：每个 chip「#名称 · 计数」，按计数降序，颜色用 `tag.color` 做 4px 左边条；超过 40 个时分「常用 / 全部」两组（阈值写常量）。右 rail 不动。理由：标签没有描述，卡片里 70% 是占位文案。
5. **系列卡与系列详情序号。** `SeriesCard`：封面 2.4:1 → 16:9；标题 1.125rem / 1.3；描述 `line-clamp-2`；chip + 篇数合并为 meta 行「3 篇 · 最近更新 03-08」（最近一篇日期并入 `getPublicSeries` 现有 `findMany` 的 `posts` select，`take: 1, orderBy createdAt desc`，无新往返）；无封面用 `--reader-panel-muted` 文字卡。系列详情：`PostCard` 新增可选 `ordinal` prop，左侧显示两位序号（`seriesOrder`），头部 meta「11 篇 · 预计 1 小时 48 分」（`readingTimeMinutes` 求和，字段已有）。
6. **空态 / 越界 / 骨架。** 空态与越界态沿用现有 `reader-panel` 文案 + 两个链接，字号统一 0.9375rem；分类 / 标签 / 系列页没有各自的 `loading.tsx`，继续由 `(public)/loading.tsx` 兜底（受缓存契约测试约束，不读 session）。

### 数据与缓存

- 新查询：0。系列目录的「最近更新」并入现有 `findMany`；分类 / 标签详情的「最近更新」取现有返回值。
- 建议把 `(public)/series/page.tsx` 里的 `getPublicSeries` 抽到 `lib/series.ts`，与首页 E 的「系列与专题」面板共用（02 已提过）。
- `/series` 在 `PUBLIC_LIST_PATHS`；分类 / 标签 / 系列详情由 `revalidatePublicContent` 精确失效，不动。分页链接 `?page=n` 在 ISR 下按 `searchParams` 各自缓存，现状已如此。
- 组件：`TaxonomyHero`、`TaxonomyPostGrid`、`TaxonomyDirectoryCard`、`SeriesCard`、`PostCard`（`ordinal`）、新建 `TaxonomyPagination`（server 组件）、`categories/page.tsx`、`tags/page.tsx`（chips 云）、`series/page.tsx`、`series/[slug]/page.tsx`。

### 权衡

- 标签页改 chips 云后失去「每个标签一张卡」的分量感；标签多于 12 个时收益明显，少于 6 个时会显得空，可按数量切换，但两套视觉会增加维护，建议统一 chips 云。
- 分页用 server 链接而非无限滚动，和 `/posts` 的体验不一致；但分类页的 `?page=` 已是公开 URL 且需 SEO，保持链接更稳。
- 工作量 **M**（9 个组件 / 页面改样式，1 个新 server 组件，0 个新查询）。

## 5. 自评

| 维度 | 文章列表 | 文章详情 | 分类 / 标签 / 系列 |
|---|---|---|---|
| 保形程度 | 高：页头 + 列表结构不变，只折叠筛选、降精选 | 高：三栏不变，Hero / 正文 / 目录 / 评论都在原位，仅系列导航上移 | 中高：专题头与列表结构不变，标签目录从卡片改 chips 云 |
| 移动端收益 | 首屏从「页头占满」变为「页头 + 2 张卡」 | 首屏见到正文第一段；目录 / 回顶按钮不再遮评论 | 专题头从一屏压到 1/3 屏 |
| 亮色模式 | 继承 02 token | Hero 叠色改单层渐变，图片不再发灰 | 去掉 blur 圆后不再有灰雾 |
| 风险 | 精选弱化需运营认可 | 目录折叠逻辑、loading 骨架同步 | 标签页视觉变化最大 |

## 6. 实现成本汇总

| 页面 | 改动组件数 | 新组件 | 新查询 | 工作量 |
|---|---|---|---|---|
| /posts | 7 | 0 | 0 | S+ |
| /posts/[slug] | 12 | 0–1（读后条可内联） | 0 必需，1 可选 | M |
| 分类 / 标签 / 系列 | 10 | 1（分页） | 0 | M |
| 合计 | ~29 | 1–2 | 0–1 | M+（约 3 个工作日，含骨架同步与契约测试更新） |

## 7. 需要你拍板的点

1. 列表页精选：「置顶一张」（推荐）还是「前 3 篇大卡」。
2. 标签目录：统一 chips 云（推荐）还是保留卡片。
3. 无系列文章的「上一篇 / 下一篇」：接入（+1 可选查询）还是不做。
4. 文章 Hero 高度：clamp(16rem, 30vw, 22rem)（推荐）还是保守的 clamp(18rem, 34vw, 26rem)。

默认按推荐项进入批次 2（搜索、归档、专题指南）。
