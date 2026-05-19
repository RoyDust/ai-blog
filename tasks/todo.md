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
