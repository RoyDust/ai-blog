# 博客升级计划：证据驱动的分阶段执行方案

> 分析日期：2026-05-16  
> 目标：在不牺牲现有 CMS、AI、阅读统计与后台稳定性的前提下，把博客从“功能完整”推进到“可持续运营、可发现、可分发、可增长”。  
> 范围：公开阅读路径、内容组织、社交分发、发布工作流、运营统计、订阅增长、前端体验实验。  
> 计划状态：已根据当前代码静态分析修订。本文只规划，不直接实施功能代码。

## 1. 项目事实

| 事实 | 证据 | 对计划的影响 |
| --- | --- | --- |
| 当前栈是 Next.js 16.1.6、React 19.2.3，已安装 `recharts`、`sonner`、`lucide-react` | `package.json:35-52` | 仪表盘图表、toast、图标不需要新增依赖；OG 图优先使用 `next/og`。 |
| 数据模型已有文章、访问日志、阅读事件、评论、点赞、收藏、系统设置，但没有 Newsletter、Series、Scheduled Publish 字段 | `prisma/schema.prisma:133-183`, `prisma/schema.prisma:185-225`, `prisma/schema.prisma:262-269`, `prisma/schema.prisma:578-632` | 新增数据能力要拆 migration，避免把订阅、系列、定时发布绑成一个大迁移。 |
| 站点配置已通过 `SystemSetting` 的 `blog.site` 键读取和保存 | `src/lib/blog-settings.ts:7`, `src/lib/blog-settings.ts:321-365` | Newsletter 配置可扩展现有设置体系，避免另起一套配置存储。 |
| 发布接口目前只接受 `id` 与 `published`，发布时直接写 `publishedAt = new Date()` | `src/lib/validation.ts:566-572`, `src/app/api/admin/posts/publish/route.ts:14-47` | 定时发布需要先扩展输入校验与状态语义，再接 cron。 |
| 编辑器侧边栏已有“发布时间”占位，但明确不提交排程数据 | `src/components/posts/AdminPostWorkspace.tsx:617-620` | 定时发布 UI 可以复用这个位置，风险可控。 |
| 文章详情页使用 `ReactMarkdown` 渲染，已自定义标题和图片，但未包装 `pre` 代码块 | `src/app/(public)/posts/[slug]/page.tsx:328-377` | 代码块复制按钮是低风险、小范围改动。 |
| 文章详情的评论已使用 `Suspense`，不是完全阻塞正文首屏 | `src/app/(public)/posts/[slug]/page.tsx:65-91`, `src/app/(public)/posts/[slug]/page.tsx:419-427` | 不把“评论拆分”放进本轮核心升级，避免重复解决已部分处理的问题。 |
| 后台首页已经有真实访问趋势，但图表是手写 SVG | `src/app/admin/page.tsx:267-348` | 数据分析仪表盘应优先提取数据聚合与替换图表，而不是重写整页。 |
| 访问趋势已有 7/30/90 天范围解析和访问日志聚合工具 | `src/lib/analytics.ts:15-51`, `src/lib/visit-log-repository.ts:40-80` | 仪表盘升级应复用这些工具，补阅读/互动统计即可。 |
| 缓存失效覆盖首页、文章列表、归档、文章、分类、标签，不含系列路径 | `src/lib/cache.ts:9-26`, `src/lib/cache.ts:87-117` | 系列功能必须同步补 cache revalidation。 |
| sitemap 当前只输出首页、文章、归档、分类、标签 | `src/app/sitemap.ts:63-112` | 系列页、专题 feed、OG 图上线时要同步补机器可读入口。 |
| robots 只禁止后台、API、个人资料和旧写作入口，没有禁止 `/series` | `src/app/robots.ts:7-18` | 原计划中的“移除 `/series` Disallow”不成立，应改为确认新增系列页可索引。 |

## 2. 修订结论

原计划中的 7 项方向大体成立，但需要调整优先级和边界：

1. **先补现有链路断点，再新增重功能。** `docs/2026-05-10-open-source-blog-benchmark-improvement-analysis.md:68-87` 已指出 `/posts?category=...` 与 `/posts?tag=...` 未闭环，这比新增 Newsletter 更直接影响读者发现路径。
2. **数据库变更拆成三条独立线。** Newsletter、Scheduled Publish、Series 的回滚风险和测试面不同，不应合并为一个 migration。
3. **Cache Components(PPR) 与 View Transitions 不作为生产主线。** Next.js 16 的 PPR 路径已转向 `cacheComponents`，View Transitions 文档明确不建议生产使用；这两项应进入实验分支，验证通过再合并。
4. **Newsletter 不强制绑定 `resend`。** 项目规则要求不随意新增依赖。本计划先定义邮件发送适配器和开发期 no-op/日志实现；生产邮件服务作为单独依赖决策。
5. **数据分析仪表盘不新建孤立系统。** 现有 `VisitLog`、`ReadingEvent`、`Like`、`Comment` 已能支撑第一版运营统计，先复用，后扩展。

## 3. 分期总览

| 阶段 | 名称 | 目标 | 依赖 | 风险 |
| --- | --- | --- | --- | --- |
| P0 | 低风险读者体验补强 | 代码复制、筛选链路、OG fallback / feed 补强 | 无 | 低 |
| P1 | 发布工作流增强 | 定时发布端到端可用 | Post migration、cron secret | 中 |
| P2 | 内容组织增强 | 系列/合集从后台到前台闭环 | Series migration | 高 |
| P3 | 运营数据增强 | 后台统计从 SVG 面板升级为可复用聚合数据 + Recharts | 现有访问日志、阅读事件 | 中 |
| P4 | Newsletter 增长闭环 | 订阅、验证、退订、发布通知 | 邮件服务决策 | 中 |
| P5 | 前端实验 | Cache Components(PPR) / View Transitions 验证 | Next 16 缓存模型与实验特性 | 中 |

## 4. P0：低风险读者体验补强

### P0.1 代码块复制按钮

**目标**

- 在文章详情页所有 Markdown 代码块右上角提供复制按钮。
- 不改变 Markdown 内容解析、代码高亮和现有文章布局。

**实现范围**

- 新建 `src/components/blog/CopyCodeButton.tsx`。
- 修改 `src/app/(public)/posts/[slug]/page.tsx` 的 `ReactMarkdown.components.pre` 渲染逻辑。
- 更新 `src/components/blog/index.ts` 导出。

**验收标准**

- 代码块渲染包含可聚焦按钮，按钮有明确 `aria-label`。
- 点击后调用 `navigator.clipboard.writeText`，成功态 2 秒后恢复。
- Clipboard 不可用或失败时不破坏代码块阅读。
- 增加 `src/app/posts/[slug]/__tests__/article-experience.test.tsx` 或相邻测试，覆盖 `pre > code` 包装与按钮文案。

### P0.2 `/posts` 筛选链路闭环

**目标**

- `/posts?category=...`、`/posts?tag=...`、`/posts?q=...` 能正确首屏展示筛选结果，并在分页时保留筛选参数。

**实现范围**

- 修改 `src/app/(public)/posts/page.tsx`，接收并校验 `searchParams`。
- 复用 `src/components/blog/FilterBar.tsx` 的筛选状态。
- 修改 `src/components/blog/PostsListingClient.tsx`，分页 URL 保留 `category`、`tag`、`q`、`limit`。
- 若 API 已支持这些参数，只补页面装配；若 API 不完整，再补 `src/app/api/posts/route.ts`。

**验收标准**

- 从分类页“在列表页中筛选”进入后，列表页不回退到全部文章。
- 翻到下一页后仍保留筛选条件。
- 增加组件测试覆盖 `category`、`tag`、`q` 三类参数。
- 增加一个 Playwright reader smoke，覆盖分类页跳转到筛选后的文章列表。

### P0.3 OG fallback 与 feed 补强

**目标**

- 没有封面图的文章也能生成稳定社交分享图。
- RSS 输出继续可用，并补充作者、分类、标签等基础分发信息。

**实现范围**

- 新建 `src/app/opengraph-image.tsx`。
- 新建 `src/app/(public)/posts/[slug]/opengraph-image.tsx`。
- 文章 metadata 保持“有 coverImage 优先使用 coverImage，无 coverImage 使用动态 OG fallback”的策略。
- 修改 `src/app/rss.xml/route.ts`，补 `author`、`category`、`updated` 等字段。

**硬边界**

- 本轮 P0.3 不新增 taxonomy feed 路由。
- `src/app/(public)/tags/[slug]/feed.xml/route.ts` 与 `src/app/(public)/categories/[slug]/feed.xml/route.ts` 归入后续 Distribution Follow-up，不分配给本轮 Agent C。
- Agent C 在 Batch 1 不修改 `src/app/(public)/posts/[slug]/page.tsx`；如必须调整文章 metadata，由 Gate 3 owner 在 Agent B 完成后串行集成。

**约束**

- 使用 `ImageResponse` from `next/og`，不新增 `@vercel/og`、`satori`、`resvg-js` 依赖。
- 只使用 `public/font` 下已有字体，控制 OG 生成 bundle 体积。

**验收标准**

- `/opengraph-image` 与 `/posts/[slug]/opengraph-image` 返回 `image/png`。
- 有封面的文章 metadata 仍使用封面图。
- 无封面的文章 metadata 有稳定 fallback。
- RSS XML 测试继续通过，并新增字段断言。

## 5. P1：定时发布

### 数据模型

新增到 `Post`：

```prisma
scheduledAt DateTime?
```

建议新增索引：

```prisma
@@index([published, scheduledAt])
```

### API 与服务端逻辑

**修改**

- `src/lib/validation.ts`：`parsePublishInput` 支持可选 `scheduledAt`。
- `src/app/api/admin/posts/publish/route.ts`：支持三种状态转换：
  - 立即发布：`published=true`，`publishedAt=now()`，`scheduledAt=null`。
  - 排程发布：`published=false`，`publishedAt=null`，`scheduledAt=futureDate`。
  - 取消发布/转草稿：`published=false`，`publishedAt=null`，`scheduledAt=null`。
- `src/components/posts/AdminPostWorkspace.tsx`：把当前“发布时间”静态字段替换为日期时间输入和“立即发布 / 定时发布 / 草稿”状态。

**新增**

- `src/app/api/cron/publish-scheduled/route.ts`。
- `src/app/api/cron/publish-scheduled/__tests__/route.test.ts`。
- `.github/workflows/publish-scheduled.yml`，或在现有 `daily-ai-news.yml` 中明确拆出独立 job。

### Cron 约束

- 复用 `AI_NEWS_CRON_SECRET` 可以降低配置成本，但 endpoint 命名和日志 operation 必须区分 `cron.publishScheduled`。
- Cron 每 5 分钟触发前，需要确认 GitHub Actions 频率和部署环境成本；第一版可使用 15 分钟。
- Cron 发布后必须调用 `revalidatePublicContent`。

### 验收标准

- 未来时间不能被立即发布。
- 排程发布时间必须严格晚于服务端当前时间；`scheduledAt <= now()` 返回 400 校验错误，提示用户改用“立即发布”。
- `src/app/api/admin/posts/publish/__tests__/route.test.ts` 必须覆盖过去时间、当前时间、未来时间三类输入。
- Cron 未带 bearer secret 返回 401/403。
- Cron 发布到期文章后，文章出现在公开列表、sitemap、RSS。
- 发布接口原有随机封面逻辑仍生效。

## 6. P2：文章系列 / 合集

### 数据模型

推荐使用一对多第一版，避免过早设计多系列归属：

```prisma
model Series {
  id          String   @id @default(cuid())
  title       String
  slug        String   @unique
  description String?  @db.Text
  coverImage  String?
  order       Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  deletedAt   DateTime?

  posts       Post[]

  @@index([deletedAt, order])
  @@map("series")
}
```

新增到 `Post`：

```prisma
seriesId    String?
series      Series? @relation(fields: [seriesId], references: [id], onDelete: SetNull)
seriesOrder Int     @default(0)

@@index([seriesId, seriesOrder])
```

### API

- `GET /api/series`：公开系列列表，只返回包含已发布文章的系列。
- `GET /api/series/[slug]`：公开系列详情，文章按 `seriesOrder`、`publishedAt` 排序。
- `GET/POST/PATCH/DELETE /api/admin/series`：后台 CRUD。
- `PATCH /api/admin/posts/[id]`：支持 `seriesId` 与 `seriesOrder`。

### 前台

- 新建 `src/app/(public)/series/page.tsx`。
- 新建 `src/app/(public)/series/[slug]/page.tsx`。
- 新建 `src/components/blog/SeriesCard.tsx`。
- 新建 `src/components/blog/SeriesNav.tsx`，在文章详情页展示当前系列、上一篇/下一篇。
- 更新 `src/app/sitemap.ts`，加入有内容的系列页。
- 更新 `src/lib/cache.ts`，新增 `buildSeriesPath` 并在文章和系列变更时刷新。

### 后台

- 新建 `src/app/admin/series/page.tsx`。
- 新建系列管理组件，优先复用 `src/components/admin/primitives/*` 与现有 `DataTable` 风格。
- 更新 `src/components/admin/shell/config.ts`，增加“系列”入口。
- 在 `AdminPostWorkspace` 元数据侧栏增加系列下拉与排序号输入。

### 验收标准

- 删除系列为软删除，不删除文章。
- 系列 slug 唯一，非法 slug 被拒绝。
- 公开系列页只显示已发布、未删除文章。
- 文章详情页在有系列时展示系列导航，无系列时不占位。
- sitemap 包含有已发布文章的系列页。

## 7. P3：数据分析仪表盘

### 目标

- 不重写后台首页，只把访问趋势、阅读统计和互动统计整理成可测试的数据聚合层，并把手写 SVG 替换为 Recharts。

### 实现范围

- 新建 `src/lib/admin-stats.ts`：
  - `getVisitTrendStats(range)`：复用 `findVisitLogsInRange`。
  - `getReadingStats(range)`：聚合 `ReadingEvent.durationSeconds`、`scrollDepth >= 85`、`qualified`。
  - `getEngagementStats(range)`：聚合 `Comment`、`Like`。
  - `getDashboardStats(range)`：组合以上数据。
- 新建 `src/app/api/admin/stats/route.ts`，返回统一 JSON，便于后续客户端刷新。
- 修改 `src/app/admin/page.tsx`：
  - `VisitTrendPanel` 替换为 `AreaChart`。
  - 新增阅读统计面板。
  - 新增互动统计面板。
  - 保留最近草稿、待审评论、热门文章、AI 模型清单。

### 验收标准

- 7/30/90 天范围输出稳定，非法范围回退到 7 天。
- 无访问日志、无阅读事件时显示空态，不抛错。
- Recharts 图表在测试环境不因 `ResizeObserver` 缺失而失败。
- 现有 `src/app/admin/__tests__/page.test.tsx` 继续通过，并新增统计聚合单元测试。

## 8. P4：Newsletter 增长闭环

### 原则

- 不在第一版强制新增邮件供应商依赖。
- 先落库、验证、退订、后台配置和发送适配器边界。
- 生产邮件服务可以后续选择 Resend、SMTP、现有企业邮件网关或其他服务。

### 数据模型

```prisma
model NewsletterSubscriber {
  id                String    @id @default(cuid())
  email             String    @unique
  status            String    @default("pending")
  verificationToken String?   @unique
  verifiedAt        DateTime?
  unsubscribedAt    DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@index([status, createdAt])
  @@map("newsletter_subscribers")
}
```

### 库模块

- 新建 `src/lib/newsletter.ts`：
  - `subscribe(email, requestContext)`。
  - `verify(token)`。
  - `unsubscribe(tokenOrEmail)`，优先使用不可猜测 token。
  - `listVerifiedSubscribers(batchSize)`。
- 新建 `src/lib/newsletter-mailer.ts`：
  - `NewsletterMailer` interface。
  - `createNewsletterMailer()` 根据配置选择 `noop`、`log`、生产 provider。
- 扩展 `src/lib/blog-settings.ts`：
  - 增加 `newsletter.enabled`、`newsletter.provider`、`newsletter.fromEmail`、`newsletter.replyTo`。

### API 与 UI

- `POST /api/newsletter/subscribe`。
- `GET /api/newsletter/verify?token=...`。
- `POST /api/newsletter/unsubscribe`。
- 新建 `src/components/blog/NewsletterForm.tsx`，可放到首页和文章详情底部。
- 后台设置页增加 Newsletter 配置，不把 API key 明文回显到前端。

### 发布通知

- 第一版不在发布请求里 fire-and-forget 群发，避免请求生命周期和错误追踪不可控。
- 推荐新增 `NotificationType.NEWSLETTER_POST_PUBLISHED` 或单独队列表。
- 如果暂不做队列表，发布后只记录待发送任务，由 cron 或后台按钮触发批量发送。

### 验收标准

- 同一 email 重复订阅幂等。
- 未验证订阅不会收到新文章通知。
- 退订后不会再次收到通知。
- 公开订阅 API 有基础限流。
- 邮件 provider 未配置时，生产环境失败闭合，开发环境可使用日志实现。

## 9. P5：Cache Components(PPR) / View Transitions 实验

### 结论

这不是核心发布路径，作为单独实验分支处理。

**依据**

- 当前项目使用 Next.js 16.1.6；Next.js 16 已移除 `experimental.ppr` 与路由级 `experimental_ppr`，PPR 需要通过 `cacheComponents: true` 路径验证。
- Next.js View Transition 官方文档明确说明该功能仍是 experimental，并且不推荐生产使用。
- 当前文章详情页显式 `dynamic = "force-dynamic"`，直接开启 Cache Components 不一定能带来收益，必须先做 profiling 与动态数据边界梳理。

### 实验步骤

1. 建立基准：记录首页、文章详情、文章列表的 build 输出、TTFB、LCP、hydration 报告。
2. 在实验分支配置 Cache Components：

```ts
cacheComponents: true
```

3. 按 Next 16 缓存模型处理 uncached/runtime data：能缓存的函数加 `use cache` 与 revalidation 策略，必须请求期执行的区域用 `Suspense` 隔离。
4. 如需同时验证 View Transitions，再单独加 `experimental.viewTransition = true`，并用 feature branch 保持可回滚。
5. 对 `/`、`/posts`、`/posts/[slug]` 做 Playwright 截图和导航检查。
6. 若 build warning、动态渲染行为或部署平台不稳定，则回滚实验，不阻塞 P0-P4。

### 实验产物

- 基准记录保存到 `docs/experiments/2026-05-16-cache-components-baseline.md`。
- 实验结果保存到 `docs/experiments/2026-05-16-cache-components-result.md`。
- Playwright 截图保存到 `test-results/cache-components-*`，或在结果文档记录实际 artifact 路径。
- 记录至少三组数据：`pnpm build` 输出、首页/文章列表/文章详情的首屏指标、导航截图。

### 回滚判定

- 任一路由 build 失败、出现不可解释的动态渲染错误、或关键截图显示内容缺失，直接回滚实验。
- LCP/TTFB 任一核心路径退化超过 10%，且无法用缓存边界调整修复，直接回滚实验。
- View Transitions 出现文本遮挡、后退/前进状态错乱或非 Chrome 体验异常，保留 Cache Components 结果但移除 View Transitions。

### 验收标准

- `pnpm build` 无 Cache Components / View Transition 相关错误。
- 指标对比有收益或至少无明显退化。
- Chrome 支持路径下动画不遮挡文本、不破坏 back/forward。
- 非支持浏览器体验保持原状。

## 10. 执行依赖图

```text
P0.1 CopyCodeButton ────────────────┐
P0.2 Posts Filter Chain ────────────┼── 可独立发布
P0.3 OG fallback / RSS enrich ──────┘

P1 Scheduled Publish DB ── API ── Admin UI ── Cron ── Cache/RSS/Sitemap verification

P2 Series DB ── Admin CRUD ── Post editor fields ── Public series pages ── Article SeriesNav ── Sitemap/cache

P3 admin-stats lib ── API route ── Admin dashboard Recharts

P4 Newsletter DB ── settings/mailer boundary ── public subscribe/verify/unsubscribe ── admin config ── publish notification queue

P5 Cache Components/View Transition experiment ── baseline ── route cache boundary test ── keep or revert
```

## 11. 建议执行顺序

1. **先做 P0.1 + P0.2。** 风险低，能立刻改善阅读和发现路径。
2. **再做 P0.3。** OG fallback 和 RSS 补强直接改善分发，但需要小心 metadata 回退逻辑。
3. **单独做 P1。** 定时发布涉及数据状态和 cron，必须完整测试。
4. **P2 与 P3 可并行。** 一个偏内容模型，一个偏后台统计；共享文件少。
5. **P4 在邮件 provider 决策后执行。** 没有 provider 决策时只做接口边界和 no-op/log mailer。
6. **P5 最后做。** 只作为实验，不阻塞业务功能。

## 12. 测试与验证计划

### 单元 / 组件测试

- `src/components/blog/__tests__/CopyCodeButton.test.tsx`
- `src/app/__tests__/posts-page-seo.test.tsx` 或新增 posts filter 测试
- `src/app/rss.xml/__tests__/route.test.ts`
- `src/app/api/admin/posts/publish/__tests__/route.test.ts`
- `src/app/api/cron/publish-scheduled/__tests__/route.test.ts`
- `src/lib/__tests__/admin-stats.test.ts`
- `src/lib/__tests__/newsletter.test.ts`
- `src/app/__tests__/sitemap.test.ts`

### E2E

- `e2e/reader.spec.ts`：分类/标签筛选跳转、文章详情复制代码按钮。
- `e2e/author.spec.ts`：定时发布设置、系列归属选择。
- `e2e/admin.spec.ts`：后台仪表盘 7/30/90 天切换。

### 命令

```bash
pnpm lint
pnpm test
pnpm exec tsc --noEmit --pretty false
pnpm test:e2e
pnpm build
```

### 阶段证据 Owner

| 阶段 | Owner | 必须产生的证据 | 证据路径 / 命令 |
| --- | --- | --- | --- |
| P0.1/P0.2 Reader Discovery | Agent B | 代码复制组件测试、筛选参数测试、reader e2e 更新 | `src/components/blog/__tests__/CopyCodeButton.test.tsx`、posts filter 测试、`e2e/reader.spec.ts`、`pnpm test -- --runInBand` 或等价 Vitest 命令 |
| P0.3 Distribution | Agent C | OG route 响应测试、RSS 字段断言 | `src/app/rss.xml/__tests__/route.test.ts`、OG image route 测试、`pnpm test src/app/rss.xml/__tests__/route.test.ts` |
| P1 Scheduled Publish | Agent D | 发布状态语义测试、cron 鉴权与到期发布测试、workflow 文件 diff | `src/app/api/admin/posts/publish/__tests__/route.test.ts`、`src/app/api/cron/publish-scheduled/__tests__/route.test.ts` |
| P2 Series | Agent F + Gate 3 owner | 系列 API 测试、公开系列页测试、sitemap/cache 集成测试 | series route/page tests、`src/app/__tests__/sitemap.test.ts`、`src/lib/__tests__/cache.test.ts` |
| P3 Admin Analytics | Agent E | admin-stats 聚合测试、后台页保留原面板测试 | `src/lib/__tests__/admin-stats.test.ts`、`src/app/admin/__tests__/page.test.tsx` |
| P4 Newsletter | Agent G | 订阅幂等、验证、退订、未配置 provider 行为测试 | `src/lib/__tests__/newsletter.test.ts`、newsletter API route tests |
| P5 Experiment | Agent H | baseline/result 文档、截图 artifact、build/e2e 记录 | `docs/experiments/2026-05-16-cache-components-baseline.md`、`docs/experiments/2026-05-16-cache-components-result.md` |
| Final Verification | Agent V | 总体验证报告、失败基线或通过证据 | `pnpm lint`、`pnpm test`、`pnpm exec tsc --noEmit --pretty false`、必要 `pnpm test:e2e`、`pnpm build` |

## 13. 风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 一次性 migration 太大 | 回滚困难、测试面膨胀 | Newsletter、Scheduled Publish、Series 分别 migration。 |
| 邮件供应商依赖过早绑定 | 新依赖、密钥、CSP、失败处理一起扩大范围 | 先定义 mailer interface，生产 provider 作为单独决策。 |
| Cron 发布重复执行 | 重复通知、重复缓存刷新 | 使用事务查询到期文章，发布后清空 `scheduledAt`；通知任务加幂等键。 |
| Series 模型过度设计 | 后台和前台复杂度上升 | 第一版只支持单系列归属；多系列用后续 `PostSeries` 迁移。 |
| Recharts 在 SSR/测试环境异常 | 后台首页测试不稳定 | 图表组件保持 client boundary；测试 mock `ResizeObserver`。 |
| Cache Components / View Transitions 破坏生产稳定性 | build 或导航行为异常 | 独立实验分支，最后执行，失败直接回滚。 |
| RSS/OG 与站点配置漂移 | 分享和订阅输出不一致 | 统一从 `getBlogSettings()` 和 `seo.ts` 派生。 |

## 14. 完成定义

本计划完成不是指 7 个功能全部写完，而是每个阶段达到自己的可发布状态：

- P0：读者路径补强已上线，测试覆盖筛选、复制、OG/RSS。
- P1：定时发布能从后台设置、由 cron 发布，并刷新公开页面。
- P2：系列能后台管理、文章归属、前台浏览、sitemap 收录。
- P3：后台统计聚合可测试，图表替换手写 SVG，不丢现有面板。
- P4：订阅闭环具备验证和退订，生产邮件 provider 明确且失败可追踪。
- P5：实验结果有指标记录；若不采用，有明确回滚记录。

## 15. 外部依据

- Next.js 16 PPR / Cache Components 迁移：<https://nextjs.org/docs/app/guides/upgrading/version-16>
- Next.js Cache Components：<https://nextjs.org/docs/app/getting-started/cache-components>
- Next.js View Transition config：<https://nextjs.org/docs/app/api-reference/config/next-config-js/viewTransition>
- Next.js `ImageResponse` / `next/og`：<https://nextjs.org/docs/app/api-reference/functions/image-response>

## 16. 多 Agent 执行边界

### 16.1 执行原则

- 最多同时启动 5 个实现 agent，另保留 1 个 verifier/code-reviewer 做独立验收。
- 每个 agent 必须拥有清晰写入边界；共享文件只能由指定 owner 修改。
- `prisma/schema.prisma`、migration、`src/app/(public)/posts/[slug]/page.tsx`、`src/components/posts/AdminPostWorkspace.tsx`、`src/lib/validation.ts`、`src/app/sitemap.ts`、`src/lib/cache.ts`、`src/app/rss.xml/route.ts`、`src/lib/blog-settings.ts`、`src/app/admin/page.tsx` 不允许多人同时修改。
- 数据库基础变更先落地，再并行开发依赖 Prisma Client 类型的功能。
- 每个 agent 交付时必须说明：修改文件、测试命令、未验证项、是否触碰共享文件。
- agent 之间不得回滚彼此改动；遇到共享文件冲突时上报 leader，由 leader 做集成。

### 16.1.1 禁止并行编辑清单

下列文件一次只能有一个 owner。其他 agent 只能读取，不能“顺手补一下”：

- `src/app/(public)/posts/[slug]/page.tsx`
- `src/components/posts/AdminPostWorkspace.tsx`
- `src/lib/validation.ts`
- `src/lib/ai-authoring.ts`
- `src/app/sitemap.ts`
- `src/lib/cache.ts`
- `src/app/rss.xml/route.ts`
- `src/app/rss.xml/__tests__/route.test.ts`
- `src/app/__tests__/sitemap.test.ts`
- `src/lib/blog-settings.ts`
- `src/components/admin/settings/AdminSettingsClient.tsx`
- `package.json`
- `pnpm-lock.yaml`

### 16.2 串行闸门

| 闸门 | Owner | 必须完成后才能开始 | 验收证据 |
| --- | --- | --- | --- |
| Gate 0：基线确认 | Leader | 所有实现 agent | `git status --short`、`pnpm test` 或记录当前失败基线 |
| Gate 1：数据库基础 | Agent DB | P1/P2/P4 依赖 Prisma 新字段/模型的实现 | `prisma/schema.prisma` 校验、migration 文件存在、相关 schema 测试或 `pnpm exec prisma validate` |
| Gate 2：共享 UI 集成 | Leader 或 Agent Authoring UI | P1/P2 同时需要 `AdminPostWorkspace.tsx` | 发布设置与系列字段在同一 UI 中无覆盖 |
| Gate 3：公共索引集成 | Leader 或 Agent Public IA | P0/P2 同时需要 sitemap/cache/rss/OG | sitemap/rss/cache 测试通过 |
| Gate 4：总体验证 | Agent Verifier | 所有实现完成后 | lint、unit、typecheck、必要 e2e/build |

### 16.3 推荐工作包

| Agent | 任务包 | 可并行性 | 独占写入边界 | 禁止触碰 |
| --- | --- | --- | --- | --- |
| Agent A：DB Foundation | 为 P1/P2/P4 准备 Prisma schema 与 migrations：`scheduledAt`、`Series`、`NewsletterSubscriber`，必要时补 enum/索引 | 第一批，先于依赖功能 | `prisma/schema.prisma`、`prisma/migrations/*`、schema 相关测试 | UI、API 业务逻辑、`package.json` |
| Agent B：Reader Discovery | P0.1 代码复制、P0.2 `/posts` 筛选链路、相关 reader tests | 可与 Agent E 并行；不依赖 DB；拥有文章详情页本轮唯一修改权 | `src/components/blog/CopyCodeButton.tsx`、`src/components/blog/index.ts`、`src/app/(public)/posts/[slug]/page.tsx`、`src/app/(public)/posts/page.tsx`、`src/components/blog/PostsListingClient.tsx`、`src/components/blog/FilterBar.tsx`、reader tests | `prisma/schema.prisma`、`AdminPostWorkspace.tsx`、`sitemap/cache/rss` |
| Agent C：Distribution | P0.3 OG fallback 与 RSS 字段增强 | 可与 Agent B/E 并行；不改文章详情页；若要改 sitemap/cache，需等 Gate 3 | `src/app/opengraph-image.tsx`、`src/app/(public)/posts/[slug]/opengraph-image.tsx`、`src/app/rss.xml/route.ts`、`src/app/rss.xml/__tests__/route.test.ts`、OG tests | `src/app/(public)/posts/[slug]/page.tsx`、`src/app/sitemap.ts`、`src/lib/cache.ts`，除非 leader 分配 Gate 3 |
| Agent D：Scheduled Publish | P1 定时发布 API、cron、workflow、发布测试；UI 字段等 Gate 2 后集成 | 依赖 Agent A；backend 可先行，`AdminPostWorkspace.tsx` 串行 | `src/lib/validation.ts`、`src/app/api/admin/posts/publish/route.ts`、`src/app/api/cron/publish-scheduled/*`、`.github/workflows/publish-scheduled.yml`、publish tests | `AdminPostWorkspace.tsx`，除非 leader 分配 Gate 2 |
| Agent E：Admin Analytics | P3 `admin-stats`、stats API、后台首页 Recharts 替换、统计测试 | 可与 Agent B/C 并行；不依赖 DB 变更 | `src/lib/admin-stats.ts`、`src/app/api/admin/stats/*`、`src/app/admin/page.tsx`、admin stats tests | Newsletter、Series、publish route |
| Agent F：Series | P2 系列 API、后台系列页、公开系列页、系列组件；编辑器字段等 Gate 2 后集成，sitemap/cache 等 Gate 3 后集成 | 依赖 Agent A；可与 Agent D/E 并行但避开共享文件 | `src/app/api/series/*`、`src/app/api/admin/series/*`、`src/app/(public)/series/*`、`src/app/admin/series/page.tsx`、`src/components/blog/Series*.tsx`、series tests | `src/lib/validation.ts`、`AdminPostWorkspace.tsx`、`src/app/(public)/posts/[slug]/page.tsx`、`src/app/sitemap.ts`、`src/lib/cache.ts`，除非 leader 分配集成 |
| Agent G：Newsletter | P4 订阅模型逻辑、API、表单、设置扩展；生产邮件 provider 只做 adapter，不新增依赖 | 依赖 Agent A；可与 D/F 并行；拥有 newsletter settings 扩展权 | `src/lib/newsletter.ts`、`src/lib/newsletter-mailer.ts`、`src/lib/blog-settings.ts` 的 newsletter-only 扩展、`src/app/api/newsletter/*`、`src/components/blog/NewsletterForm.tsx`、newsletter tests | `package.json`、`pnpm-lock.yaml`、`src/app/(public)/posts/[slug]/page.tsx`、发布通知群发，除非单独批准 |
| Agent H：Experiment | P5 Cache Components/View Transitions 实验、指标记录 | 最后执行，不阻塞业务功能 | 实验分支上的 `next.config.ts`、profiling notes、Playwright screenshots | 业务功能文件，除非实验明确需要 |
| Agent V：Verifier | 独立验证、冲突检查、测试覆盖审查 | 实现 agent 完成后 | 不改功能代码；可改验证报告 | 不修复实现，除非 leader 明确转为 fixer |

### 16.4 推荐并行批次

**Batch 1：无 DB 依赖，可立即并行**

- Agent B：Reader Discovery，拥有 `src/app/(public)/posts/[slug]/page.tsx` 本轮唯一修改权。
- Agent C：Distribution，不修改文章详情页，不做 taxonomy feed。
- Agent E：Admin Analytics。
- Agent A：DB Foundation。

**Batch 2：DB Foundation 完成后并行**

- Agent D：Scheduled Publish backend/cron，拥有 `parsePublishInput` 与 publish route 改动。
- Agent F：Series backend/public/admin pages，不改文章编辑器、`validation.ts`、sitemap/cache。
- Agent G：Newsletter backend/API/form。

**Batch 3：共享文件集成**

- Leader 集成 `AdminPostWorkspace.tsx`：合并定时发布字段与系列字段。
- Leader 集成 `src/lib/validation.ts`：合并 series post input 与 scheduled publish 变更，避免 Agent D/F 同时改同一文件。
- Leader 集成 `src/app/(public)/posts/[slug]/page.tsx`：如 P2/P4 需要插入 SeriesNav/NewsletterForm，必须在 Agent B 完成后串行处理。
- Leader 集成 `src/app/sitemap.ts`、`src/lib/cache.ts`：合并 series、OG/RSS/cache 影响。
- Leader 检查 `src/lib/blog-settings.ts`：合并 Newsletter settings，避免覆盖既有 about/reading settings。

**Batch 4：实验与总体验证**

- Agent H 单独验证 Cache Components / View Transitions。
- Agent V 做 lint、test、typecheck、build、必要 e2e 和代码审查。

### 16.5 共享文件 Owner 表

| 文件 | Owner | 修改时机 | 备注 |
| --- | --- | --- | --- |
| `prisma/schema.prisma` | Agent A | Gate 1 | 所有 schema 改动集中一次处理。 |
| `prisma/migrations/*` | Agent A | Gate 1 | 按 feature 拆 migration，避免一个超大 migration。 |
| `src/app/(public)/posts/[slug]/page.tsx` | Agent B；后续 Leader 集成 | Batch 1 / Batch 3 | Agent B 负责代码复制接入；SeriesNav/NewsletterForm 后续串行集成。 |
| `src/components/posts/AdminPostWorkspace.tsx` | Leader / Gate 2 owner | Batch 3 | 合并 P1 定时发布和 P2 系列字段。 |
| `src/lib/validation.ts` | Agent D；后续 Leader 集成 | Batch 2 / Batch 3 | Agent D 只改 `parsePublishInput`；series post input 由 Gate 2/3 owner 串行补。 |
| `src/lib/ai-authoring.ts` | Leader | Batch 3 或后续 | 默认不改；若 series/scheduled publish 影响 AI authoring，再单独集成。 |
| `src/app/rss.xml/route.ts` | Agent C | Batch 1 | 其他 agent 不改 RSS route。 |
| `src/app/rss.xml/__tests__/route.test.ts` | Agent C | Batch 1 | RSS 字段断言由 Agent C 负责。 |
| `src/app/sitemap.ts` | Leader / Gate 3 owner | Batch 3 | 合并 series 路由和其他分发变化。 |
| `src/app/__tests__/sitemap.test.ts` | Leader / Gate 3 owner | Batch 3 | sitemap 断言集中到 Gate 3。 |
| `src/lib/cache.ts` | Leader / Gate 3 owner | Batch 3 | 合并 series cache path。 |
| `src/lib/__tests__/cache.test.ts` | Leader / Gate 3 owner | Batch 3 | cache 断言集中到 Gate 3。 |
| `src/lib/blog-settings.ts` | Agent G，Leader 复核 | Batch 2/3 | 只扩展 newsletter settings，不重写 profile/about/reading。 |
| `src/components/admin/settings/AdminSettingsClient.tsx` | Agent G，Leader 复核 | Batch 2/3 | 只增加 newsletter settings UI，不重写现有设置页。 |
| `src/app/admin/page.tsx` | Agent E | Batch 1 | 其他 agent 不改后台首页。 |
| `src/app/admin/__tests__/page.test.tsx` | Agent E | Batch 1 | 后台首页断言由 Agent E 负责。 |
| `next.config.ts` | Agent H | Batch 4 | 实验分支修改，不混入业务功能批次。 |
| `package.json` / `pnpm-lock.yaml` | Leader | 仅显式批准后 | 默认不新增依赖。 |

## 17. Agent 派发提示模板

### Agent A：DB Foundation

```text
你负责 DB Foundation。你不是唯一在代码库里工作的 agent，不要回滚他人改动。

目标：为 docs/plans/2026-05-16-blog-top-tier-upgrade.md 的 P1/P2/P4 准备数据模型基础。

写入边界：
- prisma/schema.prisma
- prisma/migrations/*
- 必要的 schema/model 测试

任务：
1. 添加 Post.scheduledAt 与索引。
2. 添加 Series 模型和 Post.seriesId/seriesOrder 关系。
3. 添加 NewsletterSubscriber 模型。
4. 按功能拆 migration，不合并成一个大 migration。
5. 运行 prisma validate，并报告验证结果。

禁止：
- 不改 UI。
- 不改 API 业务逻辑。
- 不新增依赖。
```

### Agent B：Reader Discovery

```text
你负责 Reader Discovery。你不是唯一在代码库里工作的 agent，不要回滚他人改动。

目标：完成 P0.1 代码块复制与 P0.2 /posts 筛选链路闭环。

写入边界：
- src/components/blog/CopyCodeButton.tsx
- src/components/blog/index.ts
- src/app/(public)/posts/[slug]/page.tsx
- src/app/(public)/posts/page.tsx
- src/components/blog/PostsListingClient.tsx
- src/components/blog/FilterBar.tsx
- reader 相关测试

禁止：
- 不改 prisma/schema.prisma。
- 不改 AdminPostWorkspace.tsx。
- 不改 sitemap/cache/rss。
- 不实现 OG/RSS 或 taxonomy feed。

验收：
- 分类/标签/搜索参数首屏生效。
- 分页保留筛选参数。
- 代码块复制按钮可测试。
```

### Agent C：Distribution

```text
你负责 Distribution。你不是唯一在代码库里工作的 agent，不要回滚他人改动。

目标：完成 P0.3 OG fallback 与 RSS 字段增强。

写入边界：
- src/app/opengraph-image.tsx
- src/app/(public)/posts/[slug]/opengraph-image.tsx
- src/app/rss.xml/route.ts
- src/app/rss.xml/__tests__/route.test.ts
- opengraph-image 相关测试

禁止：
- 不改 src/app/(public)/posts/[slug]/page.tsx；如 metadata 需要调整，交给 Gate 3 owner 串行集成。
- 不改 sitemap.ts 和 cache.ts，除非 leader 后续明确分配 Gate 3。
- 不做 tags/categories feed route；taxonomy feed 属于后续 Distribution Follow-up。
- 不新增 @vercel/og、satori、resvg-js。

验收：
- OG image route 返回 image/png。
- RSS 测试覆盖 author/category/updated。
- 有 coverImage 的文章 metadata 仍优先使用封面。
```

### Agent D：Scheduled Publish

```text
你负责 Scheduled Publish。你不是唯一在代码库里工作的 agent，不要回滚他人改动。

前置：等待 DB Foundation 完成 scheduledAt 字段。

写入边界：
- src/lib/validation.ts
- src/app/api/admin/posts/publish/route.ts
- src/app/api/admin/posts/publish/__tests__/route.test.ts
- src/app/api/cron/publish-scheduled/*
- .github/workflows/publish-scheduled.yml

禁止：
- 暂不改 AdminPostWorkspace.tsx，除非 leader 分配 Gate 2。
- 不处理 Newsletter 群发。

验收：
- 立即发布、定时发布、取消发布语义有测试。
- scheduledAt <= now 返回 400，并有过去时间/当前时间测试。
- cron secret 鉴权有测试。
- cron 发布后调用 cache revalidation。
```

### Agent E：Admin Analytics

```text
你负责 Admin Analytics。你不是唯一在代码库里工作的 agent，不要回滚他人改动。

目标：完成 P3 数据聚合与后台 Recharts 仪表盘。

写入边界：
- src/lib/admin-stats.ts
- src/lib/__tests__/admin-stats.test.ts
- src/app/api/admin/stats/*
- src/app/admin/page.tsx
- src/app/admin/__tests__/page.test.tsx

禁止：
- 不改 publish route。
- 不改 Newsletter/Series 文件。
- 不新增图表依赖，复用已安装 recharts 与 shadcn chart。

验收：
- 7/30/90 天范围稳定。
- 空数据有空态。
- admin page 原有面板不丢失。
```

### Agent F：Series

```text
你负责 Series。你不是唯一在代码库里工作的 agent，不要回滚他人改动。

前置：等待 DB Foundation 完成 Series schema。

写入边界：
- src/app/api/series/*
- src/app/api/admin/series/*
- src/app/(public)/series/*
- src/app/admin/series/page.tsx
- src/components/blog/SeriesCard.tsx
- src/components/blog/SeriesNav.tsx
- series 相关测试

禁止：
- 不改 src/lib/validation.ts；post input 的 series 字段由 Gate 2/3 owner 集成。
- 不改 src/app/(public)/posts/[slug]/page.tsx；SeriesNav 接入由 Gate 3 owner 集成。
- 暂不改 AdminPostWorkspace.tsx，除非 leader 分配 Gate 2。
- 暂不改 sitemap.ts/cache.ts，除非 leader 分配 Gate 3。

验收：
- 公开系列页只显示已发布文章。
- 后台 CRUD 支持软删除。
- Article SeriesNav 有无系列时都稳定。
```

### Agent G：Newsletter

```text
你负责 Newsletter。你不是唯一在代码库里工作的 agent，不要回滚他人改动。

前置：等待 DB Foundation 完成 NewsletterSubscriber schema。

写入边界：
- src/lib/newsletter.ts
- src/lib/newsletter-mailer.ts
- src/lib/__tests__/newsletter.test.ts
- src/app/api/newsletter/*
- src/components/blog/NewsletterForm.tsx
- 必要时扩展 src/lib/blog-settings.ts，但只新增 newsletter settings

禁止：
- 不新增 resend 或其他邮件依赖。
- 不改 package.json/pnpm-lock.yaml。
- 不改 src/app/(public)/posts/[slug]/page.tsx；NewsletterForm 接入文章页由 Gate 3 owner 集成。
- 不在发布请求中 fire-and-forget 群发。

验收：
- 订阅幂等。
- 验证 token 生效。
- 退订后不会被选入发送列表。
- provider 未配置时行为可预测。
```

### Agent V：Verifier

```text
你负责独立验证。你不是唯一在代码库里工作的 agent，不要回滚他人改动。

目标：在各实现 agent 完成后验证计划完成度和回归风险。

只读优先；除非 leader 明确让你修复，不改功能代码。

检查：
- 每个 agent 的写入边界是否被遵守。
- 共享文件是否存在互相覆盖。
- lint/test/typecheck/build 是否通过。
- P0-P5 验收标准是否有证据。
- 未验证项是否被记录。

输出：
- 阻塞问题按严重度排序。
- 通过的测试命令和失败命令。
- 建议补测项。
```
