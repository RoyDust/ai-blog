# Inkforge 改进分析：对照 GitHub 成熟开源项目

- 日期：2026-10-20
- 基线：`main` @ `acfecbe`（本文所有 `路径:行号` 均以该提交为准）
- 范围：性能、UI、交互、数据库表、架构与工程五个维度
- 性质：分析文档，不改动任何应用代码

## 方法与口径

1. **先读代码再下结论。** 每条建议都给出仓库内的 `路径:行号`，统计数字均来自对 `src/`、`prisma/`、`.github/` 的直接扫描（命令见附录 A）。
2. **参考项目只引用核验过的源码。** 第 1 节列出每个参考项目实际读取的文件路径；没有读到源码的做法不写进"参考项目做法"。
3. **格式统一。** 每条改进项按 现状 → 参考项目做法 → 建议 → 工作量（S ≤ 1 天 / M 2–5 天 / L > 1 周）→ 优先级（P0 本迭代 / P1 下一阶段 / P2 有余力再做）→ 风险 展开。
4. **不碰数据。** 分析过程中未运行 E2E、未对任何数据库执行写操作；文中示例一律用占位符，不含任何 `.env` 真实值。

---

## 0. 一页摘要

### 0.1 现有优势（值得保留的做法）

| 优势 | 证据 |
| --- | --- |
| API 分层清晰：语义化错误 + 统一落响应 | 91 个 route handler 中 86 个使用 `toErrorResponse`（`src/lib/api-errors.ts`）；鉴权经 `requireSession`/`requireAdminSession` 同时登记操作日志 actor |
| 内部密钥网关 fail-closed | `middleware.ts:119-141` 的 `INTERNAL_PATH_SECRETS` 精确路径注册表，未登记路径返回 503，密钥比较常量时间 |
| 软删除 + 部分唯一索引 + 漂移纪律写进迁移 | `prisma/migrations/202608150001_soft_delete_partial_unique_indexes/migration.sql` 用 `WHERE "deletedAt" IS NULL` 的部分唯一索引，并在文件头写明 `migrate dev --create-only` 的复核规则 |
| 契约测试文化 | 13 个 `*-contract.test.ts(x)`（公共页缓存、`.env.example`、可靠性边界、后台面板边界、暗色模式、代码高亮等），289 个单测/组件测试文件，31 个 Playwright spec |
| 客户端数据层已有统一契约 | `src/lib/client-api.ts`（`apiFetcher`/`apiMutate`/`ApiRequestError`/`toErrorMessage`）+ `AppProviders` 全局 SWR 配置与 401 处理（`src/components/AppProviders.tsx:25-28`） |
| 图片与首屏细节到位 | `src/components/blog/PostCard.tsx:60-70` 使用 `fill` + `sizes` + `placeholder="blur"` + `quality={70}`；`next.config.ts` 限定 `qualities: [70, 75]`；Hero 与 Logo 标注 `priority` |
| Newsletter 交付的并发安全 | `SELECT … FOR UPDATE` 锁 + 受众快照 + `attemptId` 乐观并发（`src/lib/newsletter-delivery-execution.ts`） |
| 操作日志有预算与保留策略 | 请求体最多捕获 8KB；`src/lib/api-operation-log-retention.ts:22-28` 按行大小/时间裁剪，由 `/api/cron/log-retention` 定时触发 |
| 安全头完整 | `src/lib/security-headers.ts` 含 CSP、HSTS、`frame-ancestors 'none'`、`form-action 'self'`，并把暂时放宽的原因写成 TODO 注释（第 29-35 行） |
| SEO 基础设施齐全 | 12 个公共页面实现 `generateMetadata`；`src/app/sitemap.ts`、`src/app/robots.ts`、`src/app/rss.xml/route.ts`、分类 `opengraph-image.tsx` |
| 复杂度棘轮 | `eslint.config.mjs:15-18` 对 `max-lines-per-function`/`max-params`/`max-depth`/`complexity` 设阈值，存量超限函数单独豁免 |
| 就绪探针防堆积 | `src/lib/web-readiness.ts` 对数据库探针设 2s 预算且不允许并发探针累积 |
| 请求级缓存 | `src/lib/blog-settings.ts:448-453` 用 React `cache()` 包裹 `getBlogSettings`，同一请求内多次调用只查一次库 |
| 后台工作台拆分 | `AdminPostWorkspace.tsx` 只做编排，面板独立成组件，并由 `admin-post-workspace-layout-contract.test.tsx` 锁定边界 |

### 0.2 Top 10 高价值改进（按收益/成本排序）

| # | 改进 | 收益 | 成本 | 优先级 | 详见 |
| --- | --- | --- | --- | --- | --- |
| 1 | **页面浏览写路径瘦身**：匿名 beacon 去掉 `getServerSession`，操作日志对公共读接口与 beacon 异步化/采样，`viewCount` 改延迟聚合 | 每次 PV 从 3 次同步写 + 1 次会话解析降到 1 次写；直接降低数据库连接占用（池默认 1） | M | P0 | 2.1、2.2 |
| 2 | **CI 门禁补齐**：加 `tsc --noEmit`，修复失效 seed 脚本，E2E 去掉 `continue-on-error`，加覆盖率阈值，测试 setup 去掉生产形态主机 | 把"本地过、线上挂"的类别问题挡在合并前；杜绝测试误连生产 | M | P0 | 6.4 |
| 3 | **环境变量集中校验**：新增 `src/env.ts`（t3 模式），启动即失败 | 消灭 37 处散落的 `process.env.*` 读取与运行时才暴露的缺配 | S | P0 | 6.2 |
| 4 | **错误响应收口**：24 个手拼 `NextResponse.json({ error })` 的路由迁到 `toErrorResponse`，并用 lint 规则禁止回退 | 前端 `toErrorMessage` 契约不再有例外；错误格式单一 | S | P1 | 6.1 |
| 5 | **点赞原子化 + 身份修正**：利用已存在的 `@@unique([postId, browserId])` 做原子 toggle；登录用户写 `userId`；匿名身份不再绑定 IP | 消除并发双击产生的重复/丢失；移动网络切换不再丢点赞状态 | S | P1 | 5.2、6.3 |
| 6 | **高写入表保留策略与日聚合**：`VisitLog`/`ReadingEvent` 加保留裁剪 + `visit_daily_stats` 聚合表；`rate_limit_entries` 纳入 schema | 后台统计从全表内存聚合变为读聚合表；表体积可控 | M | P1 | 5.3、5.4、2.6 |
| 7 | **状态字段 String → enum**：6 个 `status String` 字段迁为 Prisma enum | 类型安全 + 数据库约束；与现有 10 个 enum 一致 | M | P1 | 5.1 |
| 8 | **客户端数据层收口**：13 处手写 `fetch` 迁到 `client-api`；11 个表单迁到 RHF + zod；后台筛选状态进 URL | 错误提示、加载态、401 处理一致；筛选可分享可后退 | M | P1 | 4.1、4.2、4.4 |
| 9 | **UI 基元收敛**：四层目录、三个 Button 收敛到 shadcn 单一来源；状态色改语义 token | 119 处 raw palette 与 29 处 hex 有归宿；暗色模式与后台一致性靠 token 保证 | L | P1 | 3.1、3.2 |
| 10 | **可观测性与后台任务可靠性**：`instrumentation.ts` + 结构化日志 + 错误上报；AI 任务从 `setTimeout` 改为 cron 拉取 + 租约 | 51 处 `console.*` 有去处；进程重启不再丢 AI 任务 | M | P1 | 6.5、6.6 |

快速收益（不进 Top 10 但半天内可完成）：删除 5 个未使用依赖（2.9）、`sitemap.ts` 从 `force-dynamic` 改为 ISR（2.4）、搜索页 `keepPreviousData` 打开（4.7）、`src/test/setup.ts` 改用 `http://localhost:3000`（6.4）。

---

## 1. 参考项目与核验文件

| 项目 | 核验文件（均为 GitHub 默认分支，2026-10 读取） | 用于对照的点 |
| --- | --- | --- |
| [shadcn-ui/taxonomy](https://github.com/shadcn-ui/taxonomy) | `prisma/schema.prisma`、`components/user-name-form.tsx`、`components/post-create-button.tsx`、`components/empty-placeholder.tsx`、`app/(dashboard)/dashboard/loading.tsx` | 单一 `components/ui` 来源、RHF + zod、路由级 loading 与空态、极简依赖 |
| [dubinc/dub](https://github.com/dubinc/dub) | `apps/web/lib/upstash/ratelimit.ts`、`apps/web/prisma/schema/link.prisma`、`apps/web/prisma/schema/schema.prisma`、`apps/web/lib/tinybird/record-click.ts`、`packages/ui/src/hooks/use-router-stuff.ts`、`apps/web/ui/links/use-link-filters.tsx` | 限流实现、索引附注释、点击事件与业务表分离、URL 筛选状态 |
| [calcom/cal.com](https://github.com/calcom/cal.com) | `packages/prisma/schema.prisma` | `BookingStatus` enum（843-849 行）与 `@default`、`@@index([userId, status, startTime])`（927 行）、`BookingAudit` 审计表、`zod`/`kysely`/`enums` 三个 generator |
| [umami-software/umami](https://github.com/umami-software/umami) | `prisma/schema.prisma`、`.github/workflows/`（ci/cd/gitleaks）、根目录 `biome.json` | 事件表 `WebsiteEvent`/`Session` 的组合索引、`@db.Timestamptz(6)`/`@db.Uuid`/`VarChar(n)`、CI 工具链 |
| [TryGhost/Ghost](https://github.com/TryGhost/Ghost) | `ghost/core/server/data/schema/schema.js` | `posts.status` 的 `isIn` 枚举校验（157-164 行）、`posts_meta` 拆表、`email_batches`/`email_recipients` 分批发送、`jobs` 表（1866 行起）、`actions` 审计表 |
| [leerob/site](https://github.com/leerob/site) | `app/layout.tsx` | `next/font/google`、`metadataBase`、`title.template`、`@vercel/analytics` |
| [payloadcms/payload](https://github.com/payloadcms/payload) | `packages/payload/src/versions/baseFields.ts` | `_status` select 字段：`draft`/`published`、`defaultValue: 'draft'`、`index: true` |
| [steven-tey/novel](https://github.com/steven-tey/novel) | `apps/web/components/tailwind/advanced-editor.tsx`、`packages/headless/src/plugins/upload-images.tsx` | 500ms 防抖自动保存 + `saveStatus` 徽标 + 字数统计、`handleImagePaste`/`handleImageDrop` |
| [t3-oss/create-t3-app](https://github.com/t3-oss/create-t3-app) | `cli/template/base/src/env.js` | `createEnv` 的 server/client 分区、`runtimeEnv` 显式映射、`skipValidation`、`emptyStringAsUndefined` |
| [lobehub/lobe-chat](https://github.com/lobehub/lobe-chat) | `packages/database/src/schemas/message.ts` | 索引随表声明、`jsonb` 承载弹性负载、共享 `timestamps`/`softDeleteColumns` helper、`text('type', { enum })`、`onDelete: 'cascade'` |

> 未采用的候选：`Hashnode/starter-kit`、`vercel/commerce`、`umami` 以外的分析产品——本轮未读到可引用的源码，故不写进对照。

---

## 2. 性能

### 2.1 每次页面浏览触发 3 次数据库写入与 1 次会话解析

- **现状**：`src/components/analytics/VisitTracker.tsx:32-40` 对每个页面用 `fetch(..., { keepalive: true })` 上报；服务端 `src/app/api/analytics/visit/route.ts` 先 `checkAnalyticsRateLimit`（生产环境是一次 `rate_limit_entries` 的 upsert，见 2.3），再 `getServerSession(authOptions)`（第 62 行，为匿名 beacon 解析 JWT），再查文章（66-71 行），然后在一个事务里写 `visit_logs` 并 `viewCount: { increment: 1 }`（73-84 行）；最后 `withApiOperationLogging`（第 92 行）再同步写一行 `api_operation_logs`。一次匿名 PV = 限流 upsert + 文章读 + 访问日志写 + 文章行更新 + 操作日志写。
- **参考项目做法**：dub 把点击事件写到独立的分析存储（`apps/web/lib/tinybird/record-click.ts`），业务表 `Link` 只保留 `clicks Int @default(0)` 等反规范化计数（`apps/web/prisma/schema/link.prisma:57-61`），事件写入与业务行更新解耦。umami 的 `WebsiteEvent`/`Session` 是纯追加表，索引全部围绕 `(websiteId, createdAt, 维度)` 组合设计（`prisma/schema.prisma` 中 `WebsiteEvent` 的 9 个 `@@index`），不在写路径上做任何业务表更新。
- **建议**：
  1. beacon 路由去掉 `getServerSession`：匿名访问占绝对多数，`userId` 可由客户端在已登录时附带一个短签名（或直接放弃匿名场景的 userId 关联）。
  2. `viewCount` 不再逐次 `increment`：由 cron（已有 `/api/cron/*` 网关）每 5–15 分钟从 `visit_logs` 按 `postId` 聚合回写；或先改为 `UPDATE … SET "viewCount" = "viewCount" + 1` 的单条原生 SQL，去掉事务。
  3. 对 `scope: 'analytics'` 的路由关闭操作日志或按 1% 采样（见 2.2）。
- **工作量**：M
- **优先级**：P0
- **风险/注意事项**：`viewCount` 展示会有分钟级延迟，需在后台统计页标注"每 N 分钟更新"；聚合 cron 需登记进 `middleware.ts` 的 `INTERNAL_PATH_SECRETS`，否则 fail closed。

### 2.2 操作日志中间件对所有路由同步写库

- **现状**：`src/lib/api-operation-log-route.ts:129` 对可捕获请求体的请求做 `request.clone()`，`148-169` 行在 `finally` 中 `await createApiOperationLog(...)`，即日志写入完成前响应不会返回。91 个 route 全部包了这层，包括公共 GET（搜索、推荐、点赞状态）与 beacon。
- **参考项目做法**：Ghost 的 `actions` 表只记录资源级 CRUD 事件（`schema.js` 中 `actions` 表的 `resource_type`/`event`/`actor_id`），不记录读请求；cal.com 的 `BookingAudit` 同样只记业务变更。两者都没有"每个 HTTP 请求一行"的日志表。
- **建议**：
  1. 用 Next.js 的 `after()`（`next/server`，当前仓库 0 处使用）把日志写入挪到响应之后；这不改变日志内容，只改变时序。
  2. 按 scope 分级：`admin`/`cron`/`internal` 全量记录；`public` 读接口默认只记 4xx/5xx 或采样；`analytics` 不记录（访问日志本身就是记录）。
  3. 请求体捕获只对 admin 写接口开启。
- **工作量**：S（`after()` 改造）+ S（分级策略）
- **优先级**：P0
- **风险/注意事项**：`after()` 在某些自托管运行时需要确认不会被提前终止；后台"操作日志"页的筛选默认值需同步调整，避免运营误以为公共流量消失。

### 2.3 连接池默认 1 与基于数据库的限流

- **现状**：`src/lib/prisma.ts:42,65` 读取 `DATABASE_POOL_MAX`，未设置时池大小为 1。`src/lib/rate-limit.ts:88` 在生产走 `database` 策略，`51-53` 行每次检查都执行一条 `INSERT INTO rate_limit_entries … ON CONFLICT` 的 `$queryRawUnsafe`。结合 2.1，单个 PV 至少占用连接 3 次往返；池为 1 时所有请求串行排队。
- **参考项目做法**：dub 的 `apps/web/lib/upstash/ratelimit.ts` 用 `@upstash/ratelimit` 的 `slidingWindow(10, "10 s")`，带 `prefix: "dub"`、`analytics: true`、`timeout: 1000`（超时放行），限流完全不占数据库连接。
- **建议**：
  1. 短期：`DATABASE_POOL_MAX` 默认值依部署数据库的连接上限调到 5–10，并在 `.env.example` 与部署文档写明（`env-example-contract.test.ts` 会要求同步）。
  2. 中期：限流迁到 Redis/Upstash（部署环境若无 Redis，可退化为 Node 进程内 LRU + 较宽阈值，接受多实例下不精确）。
  3. 无论哪种，`rate_limit_entries` 都需要清理过期行（目前没有任何裁剪），见 5.4。
- **工作量**：S（池大小）/ M（限流迁移）
- **优先级**：P1
- **风险/注意事项**：池放大要先确认托管数据库的 `max_connections` 与其他消费者（cron、脚本）的总和；进程内限流在多实例部署下只能作为"兜底"而非精确配额。

### 2.4 缓存只有路径级 ISR，缺少 tag 级失效；sitemap 强制动态

- **现状**：12 个公共页面均为 `export const revalidate = 300`；`src/lib/cache.ts` 只封装了 `revalidatePath`（`66`、`133-163` 行），`revalidateBlogSettings()` 要逐个打 `/` layout 加 15 个路径。仓库中没有 `unstable_cache`、`revalidateTag`、`'use cache'` 的任何使用。`src/app/sitemap.ts:5` 是 `force-dynamic`，每次爬虫访问都执行 4 张表的 `findMany`（16-60 行）。
- **参考项目做法**：leerob/site 的博客是纯静态生成 + `revalidate`，没有运行时数据层，这是"简单站点用路径级即可"的例子；本项目的数据面（设置、评论数、点赞数）更动态，适合 Next.js 官方文档中的 `unstable_cache(fn, keys, { tags })` + `revalidateTag` 组合（以下为 API 文档做法，非某个项目的实现）。
- **建议**：
  1. `getBlogSettings` 在 React `cache()` 之外再包一层 `unstable_cache(..., ['blog-settings'], { tags: ['blog-settings'] })`，设置保存时只需 `revalidateTag('blog-settings')`，`BLOG_SETTINGS_PATHS` 列表可以退役。
  2. 文章卡片的评论数/点赞数读取打 `post:<id>` tag，评论审核通过与点赞只失效该 tag，而不是整条路径。
  3. `sitemap.ts` 改为 `revalidate = 3600`，发布流程调用 `revalidatePath('/sitemap.xml')`。
- **工作量**：M
- **优先级**：P1
- **风险/注意事项**：`public-layout-cache.test.ts` 契约测试会随缓存策略调整而需要更新；`unstable_cache` 在 Next 16 仍带 `unstable_` 前缀，升级时注意 `'use cache'` 迁移路径。

### 2.5 文章详情全量预渲染与评论全量加载

- **现状**：`src/app/(public)/posts/[slug]/page.tsx:84-97` 的 `generateStaticParams` 查询全部已发布文章并逐篇构建；`99-127` 行 `getPostComments` 一次取出全部已审核评论及嵌套回复，无分页。随着文章与评论数量增长，构建时间与详情页 RSC 负载线性上涨。
- **参考项目做法**：taxonomy 只对营销页/文档做静态参数，文章列表与详情走请求时渲染；leerob/site 的 `generateStaticParams` 面向的是本地 MDX 文件（数量可控），不是数据库。
- **建议**：`generateStaticParams` 只返回最近 100 篇（按 `publishedAt`），其余依赖已开启的 `dynamicParams = true` 按需 ISR；评论默认取前 50 条顶层评论，回复折叠，"加载更多"走现有 `/api/comments`。
- **工作量**：S
- **优先级**：P1
- **风险/注意事项**：首次访问非预渲染文章会有一次冷渲染；评论分页需要与 `CommentForm` 的 `router.refresh()` 行为对齐。

### 2.6 访问统计全量加载到内存聚合

- **现状**：`src/lib/visit-log-repository.ts:40-57` 的 `findVisitLogsInRange` 选出时间段内每一行（`createdAt/visitorId/ipHash/userAgent`）交给 JS 聚合，而同文件 `59-81` 行的 `findPopularPostVisitsInRange` 已经是正确的 SQL `GROUP BY`。两种风格并存，前者在 30 天范围、日均千级 PV 时会一次拉数万行。
- **参考项目做法**：umami 的 `Session` 表为每个聚合维度建 `(websiteId, createdAt, browser|os|device|country|…)` 组合索引（`prisma/schema.prisma:73-83`），所有报表都是 SQL 聚合，从不把事件行拉进应用层。
- **建议**：把 UV/PV/设备分布改为 `COUNT(DISTINCT "visitorId")`、`date_trunc('day', "createdAt")` 的 SQL 聚合；再进一步建 `visit_daily_stats(day, postId, pv, uv)` 由 cron 增量回填，后台统计页只读聚合表（与 5.3 合并实施）。
- **工作量**：M
- **优先级**：P1
- **风险/注意事项**：`userAgent` 解析（设备/浏览器分布）若仍在 JS 做，需要在写入时就把解析结果落成列（umami 的做法），否则聚合无法下推到 SQL。

### 2.7 搜索 hydrate 过度取数

- **现状**：`src/lib/public-search.ts:109-135` 用 CTE + 加权 `ILIKE` 命中（`title/excerpt/content/author/category/tags`），随后 `207` 行 `findMany` 回填时 `include` 了完整 `category: true` 与全部标签行（`71-72` 行），而列表卡片只需要 `getPublicPostSelect` 定义的字段。`content ILIKE` 虽然有 `pg_trgm` GIN 索引，但长文全文仍是最重的一项。
- **参考项目做法**：Ghost 把 `posts_meta`（OG/Twitter 字段）从 `posts` 拆出（`schema.js:203-216`），正文列只在详情读取；本项目 `getPublicPostSelect`（`src/lib/posts.ts`）已经是同样思路的"列表投影"，搜索只是没有复用它。
- **建议**：hydrate 改用 `getPublicPostSelect({ includeTagColor: true })`；评估为 `posts` 增加 `tsvector` 生成列 + GIN，把 `content` 的命中改为全文检索，`ILIKE` 保留给标题/摘要。
- **工作量**：S（投影复用）/ M（tsvector）
- **优先级**：P2
- **风险/注意事项**：中文分词在 PostgreSQL 内建配置下效果有限，`tsvector` 方案需先用真实标题/正文验证召回，否则维持 trgm。

### 2.8 推荐算法每次请求在 JS 中重算

- **现状**：`src/lib/recommendations.ts:95-129` 每次请求取最多 200 条 `readingEvent` 和 `max(50, limit*8)` 条候选文章，`142-157` 行在内存里逐条 `scoreRecommendationCandidate` 并排序。结果对同一文章在短时间内高度稳定，却没有任何缓存。
- **参考项目做法**：dub 把需要重复计算的热门/统计结果缓存到 Redis（`Link` 注释写明"also stored on Redis"，`link.prisma:5`）；本项目没有 Redis，但 Next 的 `unstable_cache` 可以提供同等效果。
- **建议**：以 `['recommendations', postId, userIdOrAnon]` 为 key、10 分钟 TTL 缓存推荐结果；匿名用户共享同一份。
- **工作量**：S
- **优先级**：P2
- **风险/注意事项**：登录用户的个性化推荐缓存命中率低，可只缓存匿名分支。

### 2.9 客户端包：169 个 client 组件、1 处 dynamic、5 个未使用依赖、无体积预算

- **现状**：`src/` 下 502 个非测试 `.ts(x)` 文件中 169 个带 `"use client"`；`next/dynamic` 仅在 `src/components/posts/MetadataEditor.tsx:3` 使用一次；`package.json:31-49` 中 `date-fns`、`embla-carousel-react`、`input-otp`、`react-day-picker`、`react-resizable-panels` 在 `src/` 中无任何业务引用（仅 shadcn 注册文件引用后者四个）；没有 `@next/bundle-analyzer`、`size-limit` 或任何体积预算检查。
- **参考项目做法**：taxonomy 与 leerob/site 的依赖列表都只保留实际使用的 UI 原语，shadcn 组件按需拷入而不是整套安装；leerob/site 用 `next/font/google` 做字体子集化（`app/layout.tsx:3`），本项目 `globals.css:188` 通过 `--font-alibaba-puhuiti` 变量加载自定义字体，方向一致。
- **建议**：
  1. 删除 5 个未用依赖及对应未使用的 shadcn 注册文件（`carousel`、`input-otp`、`calendar`、`resizable`）。
  2. `MarkdownEditor`、代码高亮、图表类组件用 `next/dynamic` 延迟加载，后台路由优先。
  3. CI 增加 `ANALYZE=true pnpm build` 产物比对或 `size-limit`，设首屏 JS 预算。
- **工作量**：S（依赖清理）/ M（预算与拆包）
- **优先级**：P1
- **风险/注意事项**：删除 shadcn 注册文件前用 `grep -rn "from \"@/components/shadcn/ui/<name>\""` 确认零引用；`select-scroll-lock-contract.test.tsx` 等契约测试依赖部分 shadcn 文件。

### 2.10 Newsletter 串行逐封发送

- **现状**：`src/lib/newsletter-delivery-execution.ts:106-112` 用 `for (const target of deliveries)` 顺序 `await sendNewsletterEmail(...)`，一次 campaign 的耗时随订阅数线性增长，且在一个 HTTP 请求生命周期内完成。
- **参考项目做法**：Ghost 用 `email_batches`（状态 `pending/submitting/submitted/failed`，`schema.js:1648-1672`）+ `email_recipients` 两张表把一次群发切成批次，每批独立重试，批次状态可查。
- **建议**：保留现有 `attemptId` 并发控制，把发送循环改为固定并发（例如 5）的 worker 池，并在 `NewsletterDelivery` 上记录 `batchNo`；超过 N 封的 campaign 交给 cron 分批续跑而不是单请求跑完。
- **工作量**：M
- **优先级**：P2
- **风险/注意事项**：邮件服务商有每秒速率限制，并发数需按供应商文档设定；分批续跑要复用现有的 `FOR UPDATE` 锁避免双跑。

---

## 3. UI

### 3.1 四层 UI 基元目录与三个 Button

- **现状**：`src/components/ui/`（7 个自定义组件，含 `Button.tsx`）、`src/components/shadcn/ui/`（55 个 registry 文件，含 `button.tsx`）、`src/components/admin/ui/`（13 个自有副本：`button/badge/card/dialog/dropdown-menu/input/table/textarea/modal/confirm-dialog/alert-dialog/…`）、`src/components/admin/primitives/`（5 个：`AdminPagination/PageHeader/StatusBadge/Toolbar/WorkspacePanel`）并存，`Button` 有三份实现。新人无法从目录判断"应该用哪个"。
- **参考项目做法**：taxonomy 只有一个 `components/ui/`（shadcn 原语），业务组件（`user-name-form.tsx`、`post-create-button.tsx`、`empty-placeholder.tsx`）直接放在 `components/` 根下组合原语，没有第二套按钮。
- **建议**：
  1. 冻结 `admin/ui` 新增；逐个把 `admin/ui/*` 替换为 `shadcn/ui/*` 的 re-export 或薄包装（先 `button/input/textarea/badge/card`，它们的 API 最接近）。
  2. `components/ui` 保留公共页特有的视觉组件（`FallbackImage` 等），但其内部按钮/输入也基于 shadcn 原语。
  3. 在 `components/README.md`（新建）写明三条规则：原语只来自 `shadcn/ui`；后台组合件放 `admin/primitives`；公共页组合件放 `components/blog`。
- **工作量**：L
- **优先级**：P1
- **风险/注意事项**：`admin/ui/__tests__` 与多处 E2E 选择器依赖现有 DOM 结构，迁移要按组件逐个跑对应 spec；三个 Button 的 `variant` 命名不一致，需要先做映射表。

### 3.2 状态色硬编码：119 处 raw palette、29 处 hex，语义 token 零使用

- **现状**：`src/components` 与 `src/app`（排除 shadcn 目录与测试）中出现 119 个 Tailwind 原始色阶类，前八位是 `text-rose-500(18)`、`text-rose-600(16)`、`bg-rose-50(15)`、`text-rose-700(13)`、`bg-amber-50(7)`、`border-rose-200(6)`、`bg-emerald-50(6)`、`text-amber-700(5)`——几乎全是"错误/警告/成功"状态色；另有 29 处 `#rrggbb` 字面量。而 shadcn 的语义 token（`bg-muted`、`text-muted-foreground`）在 shadcn 目录之外 0 处使用。`globals.css:113` 的 `@theme inline` 已经用 OKLCH + `--hue` 驱动主色，但没有定义 `success/warning/danger/info` 四组语义色。
- **参考项目做法**：taxonomy 的 `globals.css` 把所有颜色收敛为 `--background/--foreground/--muted/--destructive/…` 语义变量并在暗色下整体覆盖，组件只写 `bg-background text-foreground`；dub 的 UI 包同样以语义类为主。
- **建议**：
  1. 在 `@theme inline` 增加 `--color-success/--color-warning/--color-danger/--color-info` 及其 `-foreground`/`-muted` 变体，暗色模式一并定义。
  2. 推广已有的 `admin/primitives/StatusBadge.tsx`：所有状态标签通过它渲染，禁止在业务组件写 `text-rose-*`。
  3. 加一条 ESLint `no-restricted-syntax`（或 Stylelint）规则拦截新增的 `#hex` 与 `-(rose|amber|emerald)-\d+`，存量用 `// eslint-disable-next-line` 标注逐步清理。
- **工作量**：M
- **优先级**：P1
- **风险/注意事项**：`dark-mode-contract.test.tsx` 与 `code-highlight-contract.test.ts` 对部分颜色有断言，改 token 时同步更新；OKLCH 的 `rose` 对应色需要在深色背景下复核对比度。

### 3.3 路由级 loading 与空态覆盖不足

- **现状**：`src/app` 下只有 2 个 `loading.tsx`（`(public)/posts/[slug]`、`admin`），`error.tsx` 3 个，`not-found.tsx` 2 个。公共列表页（`posts`、`categories/[slug]`、`tags/[slug]`、`series`、`archives`、`search`）在导航时没有骨架屏，依赖 ISR 命中掩盖；后台各列表的空态文案由各组件自写，没有统一的空态组件。
- **参考项目做法**：taxonomy 为仪表盘路由提供 `app/(dashboard)/dashboard/loading.tsx`，用 `PostItem.Skeleton` 重复 5 次复用列表项骨架；空态统一走 `components/empty-placeholder.tsx`（图标 + 标题 + 描述 + 操作位的复合组件）。
- **建议**：为 `(public)/posts`、`(public)/search`、`(public)/categories/[slug]`、`(public)/tags/[slug]` 和 `admin/*` 二级路由补 `loading.tsx`，骨架复用 `PostCard`/表格行的 `Skeleton` 子组件；新建 `components/ui/EmptyState.tsx` 收口空态。
- **工作量**：S
- **优先级**：P2
- **风险/注意事项**：`loading.tsx` 会把该段路由包进 `Suspense`，与 `experimental.viewTransition` 叠加时要确认过渡动画不闪白（`globals.css:208` 起的 `@view-transition` 配置）。

### 3.4 可访问性：aria-live 为 0、无 a11y lint

- **现状**：`aria-label` 114 处、`role=` 49 处、`focus-visible` 88 处、1 个跳转链接——基础不差；但 `aria-live` 0 处，意味着 toast（`sonner`）之外的异步区域更新（点赞数、搜索结果数、AI 生成进度）对读屏不可感知。`eslint.config.mjs` 未启用 `eslint-plugin-jsx-a11y`。
- **参考项目做法**：shadcn 原语（本项目 `shadcn/ui` 目录即是）基于 Radix，已自带焦点管理与 ARIA；taxonomy 直接依赖这一层而不额外手写 `role`。差距不在原语而在业务组件的异步区域。
- **建议**：搜索结果计数、点赞/收藏按钮的计数、AI 任务进度条外层加 `aria-live="polite"`；表单错误用 `aria-describedby` 关联（shadcn `FormMessage` 已做，自定义 `Input` 的 `error` prop 需补）；启用 `jsx-a11y` recommended 规则集并以 warn 起步。
- **工作量**：S
- **优先级**：P2
- **风险/注意事项**：`aria-live` 区域内容变化过频会造成读屏噪音，计数类更新应合并（例如 300ms 内只播报最后一次）。

### 3.5 后台与前台的主题体系耦合方式

- **现状**：后台通过 `AdminLayout.tsx:38-39` 的 `admin-theme` class 进入独立作用域，`globals.css:198-200` 目前只覆盖 `--font-display`；主题切换与暗色变量全部沿用前台定义（`@custom-variant dark`，`globals.css:8`）。这是好的——但后台大量 `admin/ui` 组件用 `bg-[var(--background)]` 形式直接引用 CSS 变量而不是 Tailwind token 类（`AdminLayout.tsx:38` 即是），绕过了 `@theme inline` 的映射。
- **参考项目做法**：taxonomy 的 dashboard 与 marketing 页共享同一套 token，布局差异只体现在 `DashboardShell` 这类结构组件，不建立第二套主题作用域。
- **建议**：把 `bg-[var(--background)]` 这类写法替换为 `bg-background`；`admin-theme` 作用域只保留字体差异，避免日后在其中堆叠颜色覆盖重新长出第二套主题。
- **工作量**：S
- **优先级**：P2
- **风险/注意事项**：替换前确认 `@theme inline` 里确有对应 `--color-background` 映射（`globals.css:113` 起）。

---

## 4. 交互

### 4.1 13 个客户端组件绕过 `client-api` 手写 `fetch`

- **现状**：以下客户端组件直接 `fetch('/api/...')` 而不是 `apiFetcher`/`apiMutate`：`src/components/blog/LikeButton.tsx`、`src/components/blog/ArticleReadTracker.tsx`、`src/components/analytics/VisitTracker.tsx`、`src/components/posts/MarkdownEditor.tsx`、`src/components/posts/PublishChecklist.tsx`、`src/components/posts/EditorWorkspace.tsx`、`src/components/posts/hooks/useAiActions.ts`、`src/components/posts/hooks/useCoverUpload.ts`、`src/components/admin/ui/image-crop-upload-dialog.tsx`、`src/components/admin/covers/CoverUploadDropzone.tsx`、`src/components/admin/covers/AiCoverGenerator.tsx`、`src/components/admin/ai/PostAiWorkspace.tsx`、`src/app/admin/ai/interfaces/AiTokenGenerator.tsx`。其中 `LikeButton.tsx` 的失败回滚引用了旧闭包中的 `count`，且失败只 `console.error`，用户无任何提示；挂载时还会额外发一次状态同步请求。
- **参考项目做法**：taxonomy 的 `post-create-button.tsx` 虽然也手写 `fetch`，但失败一律 `toast({ title, description, variant: "destructive" })` 并以 `isLoading` 锁按钮，成功后 `router.refresh()`；本项目的 `src/components/CommentForm.tsx` 已是更好的本地范式（RHF + `apiMutate` + `toast.error(toErrorMessage(...))` + `router.refresh()`）。
- **建议**：
  1. 两个 beacon（`VisitTracker`、`ArticleReadTracker`）允许保留原生 `fetch`（需要 `keepalive`），其余 11 处迁到 `apiMutate`。
  2. `LikeButton` 改为 `useSWR('/api/posts/<slug>/like')` + `mutate(toggle, { optimisticData, rollbackOnError: true })`，失败 `toast.error`；去掉挂载时的手动同步。
  3. 文件上传类（`useCoverUpload`、`CoverUploadDropzone`、`image-crop-upload-dialog`）若需要进度事件，可在 `client-api.ts` 增加一个 `apiUpload` 变体而不是各自实现。
- **工作量**：S（LikeButton）+ M（其余）
- **优先级**：P1
- **风险/注意事项**：`apiMutate` 会把业务 `{ success: false }` 当错误抛出，迁移时核对各接口的成功响应形状；点赞接口目前返回 `{ success, liked }`，需要补 `count` 字段才能做乐观更新。

### 4.2 11 个表单未走 RHF + zod

- **现状**：存在 `onSubmit` 却没有 `useForm` 的组件：`src/components/admin/settings/` 下 7 个面板（`SiteSettingsPanel/AccountSettingsPanel/AboutSettingsPanel/NewsletterSettingsPanel/ReadingSettingsPanel/LogSettingsPanel/PublicProfileSettingsPanel`）、`src/components/admin/ai/AiModelManager.tsx`、`src/components/admin/ai-news/AiNewsSourcePanel.tsx`、`src/components/posts/AdminPostWorkspace.tsx`（走 `usePostForm` 自管状态，有其设计理由）、`src/components/admin/primitives/AdminPagination.tsx`（跳页小表单，可忽略）。CLAUDE.md 约定的"后台表单用 shadcn `Form`"在设置面板上没有落地。
- **参考项目做法**：taxonomy 的 `components/user-name-form.tsx:38-44` 是最小范式：`useForm({ resolver: zodResolver(userNameSchema) })` + `isSaving` 状态 + 失败 toast；schema 与组件同文件。
- **建议**：`settings-shared.ts` 已经持有各 tab 的类型/schema，7 个设置面板逐个改为 `useForm + zodResolver(schema)`，提交态用 `formState.isSubmitting`，字段错误走 `FormMessage`；`AiModelManager` 与 `AiNewsSourcePanel` 同法。`AdminPostWorkspace` 不动。
- **工作量**：M
- **优先级**：P1
- **风险/注意事项**：设置面板的"脏检查/未保存提示"若依赖现有 `useState` 比较，需要改为 `formState.isDirty`；`admin-panel-boundary-contract.test.ts` 锁定了面板文件边界，迁移不要把表单逻辑回流到 `AdminSettingsClient.tsx`。

### 4.3 乐观更新缺失

- **现状**：`useOptimistic`/`useTransition` 在 `src/` 中 0 处使用；SWR 的 `optimisticData` 也未使用。点赞、收藏、评论审核、通知已读等高频小操作都是"请求完成后才更新 UI"。
- **参考项目做法**：novel 的编辑器把"已保存/未保存"作为乐观状态即时呈现（`advanced-editor.tsx:37,76` 的 `saveStatus`），真正落库在 500ms 防抖之后（`56-63` 行）——用户感知始终是即时的。
- **建议**：列表类操作（评论审核、通知已读、文章置顶）用 SWR `mutate(key, updater, { optimisticData, rollbackOnError: true, revalidate: true })`；按钮类操作（点赞/收藏）见 4.1。不引入新库。
- **工作量**：S
- **优先级**：P2
- **风险/注意事项**：乐观更新必须配回滚与错误 toast，否则失败时 UI 与服务端静默分叉。

### 4.4 后台列表筛选状态在 localStorage 而非 URL

- **现状**：`src/hooks/useFilterMemory.ts` 把查询词/状态/分页写进 localStorage，仅 `components/admin/posts/hooks/usePostsList.ts` 与 `app/admin/comments/page.tsx` 两处采用；其余后台列表各自管理。结果是筛选不可分享、浏览器后退不恢复、同一账号在两个标签页会互相覆盖。对比前台 `src/app/(public)/search/SearchPageClient.tsx:66` 已正确使用 `useSearchParams` 作为状态源。
- **参考项目做法**：dub 的链接列表筛选全部落在 URL：`apps/web/ui/links/use-link-filters.tsx` 读写 searchParams，底层是 `packages/ui/src/hooks/use-router-stuff.ts` 提供的 `queryParams({ set, del })` 助手，排序（`link-sort.tsx`）与展示模式（`link-display.tsx`）同样进 URL。
- **建议**：新建 `src/hooks/useUrlFilters.ts`（基于 `useSearchParams` + `router.replace`，带 zod 校验与默认值），`useFilterMemory` 退化为"首次进入时的默认值来源"；SWR key 直接由 URL 派生，天然满足 `keepPreviousData`。
- **工作量**：M
- **优先级**：P1
- **风险/注意事项**：`replace` 频率需防抖，避免搜索输入每个字符都写历史；`admin-posts-list.spec.ts` 等 E2E 依赖筛选行为，需同步。

### 4.5 收藏功能双轨：服务端接口与 localStorage 并存

- **现状**：`prisma/schema.prisma` 有 `Bookmark` 模型，`src/app/api/posts/[slug]/bookmark/route.ts:24-58` 实现了基于 `prisma.bookmark` 的服务端 toggle；但前台 `src/components/blog/BookmarkButton.tsx:5,61-63` 与 `src/app/(public)/bookmarks/BookmarksPageClient.tsx:6` 全部读写 `src/lib/bookmark-store.ts` 的 localStorage。服务端接口无人调用，用户换设备即丢收藏。
- **参考项目做法**：taxonomy 的 `Post` 等用户数据只在数据库一处（`prisma/schema.prisma`），客户端不持有第二份真源。
- **建议**：登录用户走服务端接口（SWR + 乐观更新），匿名用户保留 localStorage 并在登录后一次性合并上传；`/bookmarks` 页对登录用户改为服务端渲染。
- **工作量**：M
- **优先级**：P2
- **风险/注意事项**：合并上传要做幂等（`@@unique([postId, userId])` 已存在，可直接 `createMany({ skipDuplicates: true })`）。

### 4.6 编辑器：缺快捷键、拖拽上传与字数统计

- **现状**：`src/components/posts/MarkdownEditor.tsx:321` 已支持粘贴（`onPaste`）；`usePostForm.ts:123-160` 有创建态的 localStorage 草稿与 `saveStatus`。但编辑器文件中没有 `metaKey/ctrlKey` 处理（无 Cmd+S/Cmd+B）、没有 `onDrop` 图片上传、没有字数/阅读时长统计。
- **参考项目做法**：novel 的 `advanced-editor.tsx` 同时提供 `handleImagePaste` 与 `handleImageDrop`（第 14-15 行导入，来自 `packages/headless/src/plugins/upload-images.tsx`），右上角常驻 `saveStatus` 与 `{charsCount} Words` 徽标（76-78 行），保存走 500ms 防抖。
- **建议**：为 `MarkdownEditor` 增加 `onDrop` 复用现有粘贴上传逻辑；`Cmd/Ctrl+S` 触发 `performSubmit('draft')`；在工作台头部展示字数与预估阅读时长（`Post.readingTime` 列已存在，可同口径）。不更换编辑器内核。
- **工作量**：S
- **优先级**：P2
- **风险/注意事项**：`Cmd+S` 需 `preventDefault` 阻止浏览器保存页面；拖拽上传沿用现有图片大小/类型校验。

### 4.7 键盘与搜索体验

- **现状**：后台已有 `Cmd+K` 全局搜索（`src/components/admin/shell/AdminGlobalSearch.tsx:163`）与 sidebar 快捷键（shadcn 自带），其余列表无键盘导航；前台搜索 `SearchPageClient.tsx:86` 设 `keepPreviousData: false`，每次输入都先清空结果再渲染，视觉上闪烁。
- **参考项目做法**：dub 的列表在 URL 状态驱动下天然保留上一页数据直到新数据到达（SWR 默认行为），不会出现空白闪烁。
- **建议**：搜索页改 `keepPreviousData: true` 并在结果区叠加半透明 loading 遮罩；全局搜索结果支持 `↑/↓/Enter`；文章列表支持 `j/k` 为可选项。
- **工作量**：S
- **优先级**：P2
- **风险/注意事项**：`keepPreviousData` 打开后，"无结果"判断必须基于 `data` 与 `isValidating` 的组合，否则会把上一关键词的结果误显示为当前结果。

---

## 5. 数据库表

> 逐表审阅对象：`prisma/schema.prisma`（31 个迁移目录）。四组模型中账户组（`User/Account/Session`）为 NextAuth 标准结构，不展开。

### 5.1 状态字段 String 与 enum 并存

- **现状**：schema 已有 10 个 enum（`Role/CommentStatus/PostSummaryStatus/AiNewsRunStatus/AiNewsRunTrigger/AiNewsSourceType/NotificationType/NotificationSeverity/NewsletterCampaignStatus/AiTopicStatus`），但以下 6 个状态仍是 `String`：`NewsletterSubscriber.status`（`@default("pending")`，第 233 行）、`NewsletterDelivery.status`（271）、`CoverAsset.status`（400）、`AiTask.status`（491）、`AiTaskItem.status`（520）、`TopicGuide.status`（778）。合法值只存在于 TypeScript 常量（如 `AI_TASK_ITEM_STATUSES`）与 `lib/validation.ts` 的手写校验里，数据库层不约束。
- **参考项目做法**：cal.com 的 `Booking.status BookingStatus @default(ACCEPTED)`（`schema.prisma:875`），enum 值用 `@map("accepted")` 保持数据库小写（843-849 行）；Ghost 虽用字符串列，但在 schema 定义里以 `validations: { isIn: [[...]] }` 强制合法值（`schema.js:157-164`，`posts.status`）；payload 的 `_status` 是带 `options` 的 select 字段并 `index: true`；lobe-chat 用 `text('type', { enum: [...] })` 在 drizzle 层声明。四个项目都没有"状态列完全无约束"的情况。
- **建议**：按风险从低到高迁移——`TopicGuide.status`、`CoverAsset.status` 先行（写入点少），`AiTask/AiTaskItem` 次之，`Newsletter*` 最后（涉及正在进行的投递）。每次迁移：`ALTER TABLE … ALTER COLUMN status TYPE "XxxStatus" USING status::"XxxStatus"`，迁移前先 `SELECT DISTINCT status` 核对脏值。enum 值用 `@map` 保持现有小写字符串，应用代码不改。
- **工作量**：M
- **优先级**：P1
- **风险/注意事项**：Prisma enum 迁移会生成 `CREATE TYPE` + `ALTER COLUMN`，大表上锁时间短但需在低峰执行；`AI_TASK_ITEM_STATUSES` 等常量改为从 Prisma 生成的 enum 导出，避免两份真源。

### 5.2 Like 双唯一键与非原子 toggle

- **现状**：`Like` 模型（第 807-822 行）同时有 `@@unique([postId, userId])` 与 `@@unique([postId, browserId])`，两列均可空。`src/app/api/posts/[slug]/like/route.ts:27-45` 的 toggle 是 `findFirst` → `delete`/`create` 三步，不在事务内，且只写 `browserId`（`anonymousActor.actorId`），`userId` 从未被写入，登录用户的点赞与匿名身份绑定。并发双击会出现"两次 findFirst 都为空 → 第二次 create 撞唯一键 500"。
- **参考项目做法**：dub 的 `Link` 用 `@@unique([domain, key])` 并以 upsert 语义写入（索引注释 `// for upserting a link by URL`，`link.prisma:100`）；cal.com 对 `Booking` 的状态流转用 enum + 事务。两者都不依赖"先查再写"。
- **建议**：
  1. toggle 改为原子操作：`deleteMany({ where: { postId, browserId } })` 返回 `count`，为 0 时 `create` 并捕获 `P2002` 视为已点赞；或一条原生 `INSERT … ON CONFLICT DO NOTHING RETURNING id`。
  2. 登录用户写 `userId`，匿名写 `browserId`；读取时 `OR` 两者。
  3. 返回 `count` 以支持 4.1 的乐观更新。
- **工作量**：S
- **优先级**：P1
- **风险/注意事项**：历史数据中登录用户的点赞都挂在 `browserId` 上，切换后旧点赞不会自动归到账号，需一次性迁移脚本或接受"重新点赞"。

### 5.3 高写入表没有保留策略

- **现状**：`VisitLog`（307-327 行，6 个索引）与 `ReadingEvent`（329-347 行，`readDate @db.Date` + `@@unique([userId, postId, readDate])`）都没有任何裁剪/归档逻辑；仓库内只有 `ApiOperationLog` 有保留策略（`api-operation-log-retention.ts:22-28` 按 `pg_column_size` 与时间删除）。`VisitLog` 每 PV 一行，不分区、不聚合。
- **参考项目做法**：umami 的 `Website.resetAt`（`schema.prisma:102`）配合事件表的 `createdAt` 索引支持按站点重置数据；事件表本身只做追加，所有报表读聚合查询（见 2.6）。dub 则干脆把点击事件放到 Tinybird，MySQL 里只留计数。
- **建议**：
  1. 新建 `visit_daily_stats(day date, post_id, pv int, uv int, PRIMARY KEY(day, post_id))`，cron 每小时增量 upsert 当天与前一天。
  2. `visit_logs` 保留 90 天（可配置，复用 `SystemSetting`），由现有 `/api/cron/log-retention` 扩展一个分支；`reading_events` 以用户阅读历史为目的保留 365 天。
  3. 若日 PV 稳定过万再考虑按月 range partition（PostgreSQL 原生），当前规模不必。
- **工作量**：M
- **优先级**：P1
- **风险/注意事项**：裁剪前先确认后台"热门文章/阅读分析"的时间范围上限（目前最大 30 天则 90 天保留足够）；聚合表回填要幂等（`ON CONFLICT (day, post_id) DO UPDATE`）。

### 5.4 Prisma 不可见的部分唯一索引与 schema 之外的表

- **现状**：`*_active_unique` 部分唯一索引只存在于迁移 SQL（`202608150001_soft_delete_partial_unique_indexes/migration.sql`），`schema.prisma` 中没有对应声明，迁移文件头部写明 `migrate dev` 会试图 `DROP INDEX`。`rate_limit_entries` 表完全不在 schema 里，只在 `src/lib/rate-limit.ts:51-53` 的原生 SQL 中出现。两者都让 `prisma migrate diff` 无法作为漂移检测的依据。
- **参考项目做法**：lobe-chat 在 drizzle 里把索引随表声明（`message.ts` 中 `(t) => ({ ... index('messages_created_at_idx').on(t.createdAt) ... })`），schema 文件就是唯一真源；cal.com 用 `zod`/`kysely`/`enums` 三个 generator 从一份 `schema.prisma` 派生其他产物，没有 schema 外的表。Prisma 本身目前不支持声明部分唯一索引，这是本项目选择软删除后不可避免的成本，但可以把成本"显式化"。
- **建议**：
  1. `rate_limit_entries` 加入 `schema.prisma`（`model RateLimitEntry { key String @id; count Int; resetAt DateTime @map("reset_at") @@map("rate_limit_entries") }`），现有原生 SQL 不用改。
  2. CI 增加 `prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url <占位> --exit-code`，并把 `*_active_unique` 的预期差异写进一个允许列表脚本，其他差异即失败。
  3. 在 `schema.prisma` 的 `Post/Category/Tag/Series` 模型上用 `///` 文档注释标明"slug 唯一性由 `<table>_slug_active_unique` 部分索引保证，见迁移 202608150001"。
- **工作量**：S
- **优先级**：P1
- **风险/注意事项**：`migrate diff` 需要影子库，CI 里用 `services: postgres` 即可（`ci.yml` 已有数据库服务）；不要在生产库上跑 diff。

### 5.5 索引与查询对齐缺少说明

- **现状**：`Post` 有 13 个 `@@index`（`[authorId]`、`[categoryId]`、`[published, createdAt]`、`[generatedByAiNews, createdAt]`、`[published, scheduledAt]`、`[featured, createdAt]`、`[coverAssetId]`、`[seriesId, seriesOrder]`、`[deletedAt]`、`[summaryStatus]`、`[summaryJobId]`、`[seoGeneratedAt]`、`[slug]`），没有一条注释说明服务于哪个查询。公共列表的排序 `PUBLIC_POST_ORDER_BY = [featured desc, createdAt desc, id desc]` 配合 `where: { published: true, deletedAt: null }`（`src/lib/posts.ts`），没有一个索引同时覆盖过滤与排序列。`ApiOperationLog` 7 个索引、`VisitLog` 6 个索引同样无注释。
- **参考项目做法**：dub 的 `Link` 每个索引都带用途注释：`@@index([projectId, folderId, archived, createdAt(sort: Desc)]) // most getLinksForWorkspace queries`、`@@index([domain, createdAt]) // for bulk link deletion workflows`（`link.prisma:97-107`）；cal.com 的 `@@index([userId, status, startTime])`（927 行）直接对应日程列表的过滤 + 排序。
- **建议**：
  1. 为公共列表增加部分复合索引：`CREATE INDEX posts_public_feed_idx ON posts (featured DESC, "createdAt" DESC, id DESC) WHERE published = true AND "deletedAt" IS NULL`（需手写迁移，与 5.4 同一套纪律）。
  2. 每个 `@@index` 后加 `//` 注释指向调用方函数名。
  3. 上线两周后用 `pg_stat_user_indexes` 的 `idx_scan` 找出零命中索引（`[seoGeneratedAt]`、`[summaryJobId]` 是候选），删除以降低写放大。
- **工作量**：S
- **优先级**：P2
- **风险/注意事项**：部分索引同样对 Prisma 不可见，纳入 5.4 的允许列表；删索引前先在只读副本或 `EXPLAIN (ANALYZE)` 上确认。

### 5.6 列类型与命名细节

- **现状**：全部时间列为默认 `timestamp(3)`（schema 中 `Timestamptz` 出现 0 次），全部主键为 `cuid()` 字符串；迁移目录名混用 12 位（`202604120001_…`、`202609240001_…`）与 14 位（`20260315135000_…`、`20260926101000_…`）时间戳。`ApiOperationLog.query/requestBody/metadata` 为 `Json?`（映射到 `jsonb`，合理）。
- **参考项目做法**：umami 全部时间列 `@db.Timestamptz(6)`、主键 `@db.Uuid`、字符串列显式 `@db.VarChar(n)`（`prisma/schema.prisma:13-22`）；cal.com 用 `@db.Timestamp(3)` 并在需要处 `@db.Uuid`；lobe-chat 用共享 `timestamps` helper 保证所有表的 `createdAt/updatedAt/accessedAt` 一致。
- **建议**：新表统一 `@db.Timestamptz(6)`；存量表不迁（收益小于风险）；新迁移统一 14 位时间戳，不改历史目录名；`ApiOperationLog.requestBody` 已有 8KB 上限，`metadata` 建议同样在写入端限长。
- **工作量**：S
- **优先级**：P2
- **风险/注意事项**：`timestamp` 与 `timestamptz` 混用时 Prisma 层无感，但原生 SQL 比较要注意时区；重命名历史迁移目录会让已部署环境的 `_prisma_migrations` 记录失配，绝对不要做。

### 5.7 反规范化计数器的更新方式

- **现状**：`Post.viewCount Int @default(0)` 在每次 PV 的事务中 `increment`（`visit/route.ts:83`），评论数与点赞数则在读取时用 `_count` 实时聚合（`getPublicPostSelect` 中 `_count` 过滤 `approved` 评论）。两种计数一种写放大、一种读放大，没有统一策略。
- **参考项目做法**：dub 的 `Link.clicks/leads/conversions/sales` 是反规范化计数（`link.prisma:57-61`），但由事件管线异步回写，不在请求事务里更新；Ghost 的 `posts` 表没有计数列，`members_click_events` 等事件表承担统计。
- **建议**：`viewCount` 改为 cron 从 `visit_daily_stats` 回写（与 2.1、5.3 同一改动）；评论数/点赞数保持 `_count` 实时聚合（列表每页 ≤ 20 条，开销可接受），不新增计数列。
- **工作量**：S（随 2.1 完成）
- **优先级**：P1
- **风险/注意事项**：`likeCount` 若未来加列，必须与 5.2 的原子 toggle 一起设计，否则会再出现"计数与实际行数不一致"。

### 5.8 级联与软删除的交互

- **现状**：schema 中 `onDelete: Cascade` 23 处、`SetNull` 9 处；但内容类模型（`Post/Category/Tag/Series/Comment/CoverAsset`）走软删除，`Cascade` 实际上从不触发，`Like/Bookmark/Comment` 等子表在文章软删后仍保留并计入 `_count`（除非每个查询都过滤 `post.deletedAt`）。`Comment.status` 已用 `CommentStatus` enum 且 `getPublicPostSelect` 过滤 `approved`，但 `Like`/`Bookmark` 没有等价过滤。
- **参考项目做法**：lobe-chat 对真正硬删的关系用 `onDelete: 'cascade'`（`message.ts` 中 `userId → users.id`），软删只用于顶层资源并由共享 `softDeleteColumns` helper 标注，二者不混用于同一条关系链。
- **建议**：在 `src/lib/posts.ts` 的公共计数与 `recommendations.ts` 的候选查询中显式加 `post: { deletedAt: null, published: true }`；后台"彻底删除"文章时（若有）由应用层先删子表再硬删，不依赖数据库 `Cascade`。
- **工作量**：S
- **优先级**：P2
- **风险/注意事项**：这是防御性修正，当前软删文章不进公共列表，因此对外可见的 bug 面很小。

---

## 6. 架构与工程

### 6.1 错误响应双轨

- **现状**：91 个 route handler 中 86 个使用 `toErrorResponse`，但仍有 24 个文件存在手拼 `NextResponse.json({ error: ... }, { status })` 的分支，包括 `src/app/api/analytics/visit/route.ts:38,45,54`、`src/app/api/posts/[slug]/like/route.ts`、`src/app/api/posts/[slug]/bookmark/route.ts:17`、`src/app/api/comments/route.ts`、`src/app/api/search/route.ts`、`src/app/api/recommendations/route.ts`、`src/app/api/admin/posts/route.ts` 等。这些分支的响应形状（`{ error }` 而非 `{ success: false, error }`）绕过 `client-api.ts` 的解析契约。
- **参考项目做法**：taxonomy 的 route handler 以 `new Response(null, { status: 422 })` + zod `error.issues` 统一处理校验错误；本项目的 `lib/api-errors.ts` 已经是更完整的版本，问题只在于没有强制。
- **建议**：把 24 处改为 `throw new ValidationError(...)`/`throw new RateLimitError(...)` 交给 `toErrorResponse`；在 `eslint.config.mjs` 对 `src/app/api/**` 增加 `no-restricted-syntax` 规则匹配 `NextResponse.json({ error` 字面量。
- **工作量**：S
- **优先级**：P1
- **风险/注意事项**：个别路由的 429 响应可能被 E2E 以 `{ error }` 形状断言，迁移时同步 `e2e/*.spec.ts`。

### 6.2 没有环境变量校验模块

- **现状**：`src/lib` 下 37 处直接读取 `process.env.*`，缺配在首次调用时才以运行时错误暴露（`prisma.ts` 对 `DATABASE_URL` 做了延迟报错，是少数例外）；`env-example-contract.test.ts` 只保证 `.env.example` 与代码引用的变量名一致，不校验值的形态。
- **参考项目做法**：create-t3-app 模板的 `src/env.js` 用 `createEnv({ server: { DATABASE_URL: z.url(), NODE_ENV: z.enum([...]) }, client: {...}, runtimeEnv: { DATABASE_URL: process.env.DATABASE_URL, ... }, skipValidation: !!process.env.SKIP_ENV_VALIDATION, emptyStringAsUndefined: true })`，在模块加载时一次性校验，Docker 构建期用 `SKIP_ENV_VALIDATION` 跳过。
- **建议**：新建 `src/env.ts`（zod 已是依赖，不必引入 `@t3-oss/env-nextjs`），分 `server`/`client`（`NEXT_PUBLIC_*`）两组，`Dockerfile` 构建阶段设 `SKIP_ENV_VALIDATION=1`；`src/lib` 内逐步改为 `import { env } from '@/env'`。`DATABASE_POOL_MAX`、`AI_*`、`QINIU_*` 等可选组用 `.optional()` 并在 `web-readiness.ts` 的 configuration 检查里复用。
- **工作量**：S
- **优先级**：P0
- **风险/注意事项**：`prisma.ts` 的"缺 `DATABASE_URL` 时导入安全、调用才报错"语义要保留（构建期需要），`env.ts` 对该变量在 `SKIP_ENV_VALIDATION` 下应放行。

### 6.3 安全：CSP 放宽项与匿名身份绑定 IP

- **现状**：`src/lib/security-headers.ts` 中 `script-src 'self' 'unsafe-inline'`、`img-src 'self' http: https: data: blob:`（29-35 行注释说明图片主机尚无 TLS）、`style-src` 含 `'unsafe-inline'`；`next.config.ts` 的 `remotePatterns` 对同一主机同时放行 `http` 与 `https`。`src/lib/anonymous-actor.ts:25-29` 把 `browserId` 与客户端 IP 一起 HMAC 成 `actorId`，IP 变化（移动网络、公司出口切换）即被视为新用户，点赞状态随之丢失。限流、内部密钥、HSTS、`frame-ancestors` 等其余项是到位的。
- **参考项目做法**：umami 的 CI 单独跑 `gitleaks.yml` 做密钥泄露扫描（`.github/workflows/`）；dub 的 `ratelimit.ts` 以 IP 为限流 key 但不把 IP 混入用户身份。Next.js 官方文档的 nonce 方案（middleware 生成 nonce → `script-src 'nonce-…' 'strict-dynamic'`）是替代 `'unsafe-inline'` 的标准路径。
- **建议**：
  1. 图片主机启用 TLS 后，按现有 TODO 收紧 `img-src`、加 `upgrade-insecure-requests`、删除 `remotePatterns` 的 `http` 项——这条已有计划，只需排期。
  2. `script-src` 迁移到 nonce：middleware 已存在，增量成本是给 `<Script>` 与内联 JSON-LD 传 nonce。
  3. `anonymous-actor.ts` 只对 `browserId` 做 HMAC，IP 仅用于限流；或改为服务端签发 `HttpOnly` cookie 作为匿名身份。
  4. CI 加 `gitleaks`（或 GitHub secret scanning push protection）。
- **工作量**：S（身份）/ M（nonce CSP）
- **优先级**：P1
- **风险/注意事项**：nonce CSP 与 ISR 静态页冲突（静态 HTML 无法每请求换 nonce），公共页若保持 ISR 需对其使用 hash-based CSP 或保留 `'unsafe-inline'` 仅限公共段；匿名身份改动会让存量匿名点赞失效一次。

### 6.4 CI 门禁与测试环境

- **现状**：`.github/workflows/ci.yml` 的 `validate` job 跑 `lint/test/integration/build`，但没有 `tsc --noEmit`、没有覆盖率阈值；`e2e` job 标注 `continue-on-error: true`（81-82 行），且 `139-140` 行注释承认 `seed-categories.cjs/seed-tags.cjs` 在部分唯一索引迁移后已失效，只跑 `seed-e2e-admin.cjs`。`src/test/setup.ts:6-7` 把一个生产形态的 `http://<ip>` 写入 `NEXTAUTH_URL/NEXT_PUBLIC_SITE_URL`；`.github/` 下没有 `dependabot.yml`。
- **参考项目做法**：umami 的工作流分 `ci.yml`/`cd.yml`/`cd-cloud.yml`/`gitleaks.yml`/`stale-issues.yml`，并在根目录放 `dependabot-review.md` 说明依赖更新审阅流程；taxonomy 的 `package.json` 把 `typecheck` 作为独立脚本。
- **建议**：
  1. `validate` 增加 `pnpm tsc --noEmit`（`package.json` 加 `typecheck` 脚本）。
  2. 修复两个 seed 脚本（改为 `ON CONFLICT (slug) WHERE "deletedAt" IS NULL DO NOTHING` 或先查再插），然后删除 `continue-on-error`。
  3. `vitest --coverage` 设 `lines: 70` 起步阈值（当前 289 个测试文件，基线应不难达到），逐步上调。
  4. `src/test/setup.ts` 改为 `http://localhost:3000`。
  5. 增加 `.github/dependabot.yml`（npm 周更 + github-actions）。
- **工作量**：M
- **优先级**：P0
- **风险/注意事项**：E2E 转阻塞前先在 `main` 上连续观察 5 次绿色，避免把不稳定用例一次性变成合并阻塞；`seed-e2e-admin.cjs` 必须只指向 CI 的临时数据库，绝不能复用本地 `.env`（本项目本地 `DATABASE_URL` 指向生产库，这是已经发生过的事故）。

### 6.5 可观测性缺失

- **现状**：`src/lib`、`src/app`、`src/components` 中 51 处 `console.log/error/warn`（排除测试），日志非结构化、无 request id 关联；没有 `instrumentation.ts`，没有 Sentry/OpenTelemetry/pino 等依赖；错误只能在 `api_operation_logs` 表里按 status 过滤看到。`web-readiness.ts` 提供就绪探针但无指标输出。
- **参考项目做法**：leerob/site 在 `app/layout.tsx:4,33` 挂 `@vercel/analytics`；umami 自身就是开源 Web 分析系统（本项目甚至可以直接接入 umami 的 tracker 替代自研 `VisitTracker`，见第 8 节）。dub 的 `tinybird/` 目录把所有事件以结构化 schema 落库（`record-click-zod.ts` 先用 zod 校验事件再写入）。
- **建议**：
  1. 新建 `src/instrumentation.ts`，用 `pino`（或 Node 20 内建 `util.inspect` + JSON）替换 `console.*`，统一字段 `{ level, msg, requestId, scope, durationMs }`；`withApiOperationLogging` 已有的 AsyncLocalStorage 上下文（`api-operation-log-context.ts:19`）可直接复用提供 `requestId`。
  2. 接一个错误上报（Sentry 或自托管 GlitchTip），只在生产启用。
  3. 把 `api_operation_logs` 的 5xx 比例、`web-readiness` 失败次数做成后台首页的两个数字（已有 `admin-stats.ts`，增量很小）。
- **工作量**：M
- **优先级**：P1
- **风险/注意事项**：Sentry 的 Next 集成会包一层 webpack/turbopack 插件，先在 `ANALYZE` 下确认 bundle 增量；日志中禁止输出请求体（已有 8KB 捕获逻辑属于审计日志，与运行日志分开）。

### 6.6 AI 后台任务依赖 `setTimeout` fire-and-forget

- **现状**：`src/lib/ai-batch-jobs.ts:118-119` 与 `src/lib/post-summary-jobs.ts:54-55` 在 HTTP 请求内 `setTimeout(() => void run(...))` 启动长任务。进程重启、部署、函数超时都会让 `AiTask`/`AiTaskItem` 停留在 `QUEUED/RUNNING` 不再推进；没有租约、心跳或重试计数。
- **参考项目做法**：Ghost 的 `jobs` 表（`schema.js:1866` 起）记录 `status(started/finished/failed/queued)`、`started_at`、`finished_at`、`queue_entry`，由独立 job manager 拉取；dub 把定时与延迟任务交给 QStash（`apps/web/lib/cron/` 下的 `/api/cron/*` 由外部调度触发，与本项目的 GitHub Actions cron 思路相同）。
- **建议**：`AiTask` 表已是持久化队列，缺的只是消费者：新增 `/api/cron/ai-tasks`（登记进 `INTERNAL_PATH_SECRETS`）由 GitHub Actions 每 2–5 分钟触发，每次用 `UPDATE … SET "leaseUntil" = now() + interval '5 min' WHERE status = 'QUEUED' … FOR UPDATE SKIP LOCKED LIMIT 1` 领取一项执行；超时未心跳的 `RUNNING` 项回收重试，`attempts` 达上限标 `FAILED`。请求内只负责入队。
- **工作量**：M
- **优先级**：P1
- **风险/注意事项**：GitHub Actions cron 最小粒度 5 分钟且可能延迟，用户感知从"立即开始"变为"数分钟内开始"，后台任务中心需显示排队状态；`daily-ai-news.yml` 已验证这条调度链路可用。

### 6.7 DX：格式化、钩子、依赖机器人与文档引用

- **现状**：没有 prettier/biome、husky/lint-staged、commitlint、`.editorconfig`；`.github/` 只有 workflows，无 dependabot/renovate；`CLAUDE.md` 的 Domain docs 一节引用的 `CONTEXT.md` 与 `docs/adr/` 在仓库中不存在。
- **参考项目做法**：umami 用 `biome.json` 一个工具同时覆盖 lint + format，根目录有 `dependabot-review.md`；taxonomy 用 prettier + `prettier-plugin-tailwindcss` 排序 class。
- **建议**：选 biome（单工具、快）或 prettier + `prettier-plugin-tailwindcss`（与 shadcn 生态一致）之一，先只对新改动文件格式化（`lint-staged`），不做全仓库重排版（避免淹没 git blame）；补 `.editorconfig`；创建 `docs/adr/` 并把 6.9 的决策作为第一篇 ADR，或从 `CLAUDE.md` 删除不存在的引用。
- **工作量**：S
- **优先级**：P2
- **风险/注意事项**：全仓库一次性格式化会产生巨大 diff，与全局 CLAUDE.md 的"外科手术式修改"原则冲突，务必只对触碰文件生效。

### 6.8 SEO：缺结构化数据与文章 OG 图

- **现状**：12 个公共页实现 `generateMetadata`，`sitemap/robots/rss` 齐全，但 `application/ld+json` 在 `src/app` 中 0 处；`opengraph-image.tsx` 只有 `(public)/categories/[slug]` 一处，文章页依赖 `coverImage` 作为 OG 图，无封面文章没有兜底。
- **参考项目做法**：leerob/site 的 `app/layout.tsx:9-15` 设 `metadataBase` 与 `title.template: '%s | …'`，子页只写 `title` 即可拼出完整标题。
- **建议**：文章页输出 `BlogPosting` JSON-LD（`headline/datePublished/dateModified/author/image`），首页输出 `WebSite` + `SearchAction`；为 `(public)/posts/[slug]` 增加 `opengraph-image.tsx` 作为无封面兜底（标题 + 站名的动态图）；根 `layout.tsx` 补 `metadataBase` 与 `title.template`（若尚未设置）。
- **工作量**：S
- **优先级**：P2
- **风险/注意事项**：JSON-LD 内联脚本在 6.3 的 nonce CSP 下需要带 nonce。

### 6.9 Server Actions 与 Route Handlers 混用缺少决策记录

- **现状**：`"use server"` 仅在 `src/app/admin/ai/topics/page.tsx` 一处出现，其余 91 个接口全部是 Route Handler 并统一经过 `withApiOperationLogging`、`requireAdminSession`、`toErrorResponse`。这一处 Server Action 绕过了操作日志与错误契约。
- **参考项目做法**：taxonomy 全部用 Route Handler（`app/api/**`）配合客户端 `fetch`；本项目还有 `lib/ai-interface-catalog.ts` 对外暴露 OpenAPI 目录，Route Handler 是必然选择。
- **建议**：写一篇 ADR 固化"对外/后台接口一律 Route Handler；Server Actions 仅允许用于不需要审计、不对外暴露的纯 UI 状态提交"，并把 `admin/ai/topics` 那一处迁回 Route Handler 或明确豁免。
- **工作量**：S
- **优先级**：P2
- **风险/注意事项**：无技术风险，主要是避免未来两种范式各自长出一套鉴权/日志。

---

## 7. 三阶段路线图

> 口径：一人全职；每阶段结束有可验证的产出；阶段内条目按依赖顺序排列，可并行的用同一行标出。

### 阶段一（第 1–2 周）：止血与门禁

| 顺序 | 条目 | 产出 | 对应小节 |
| --- | --- | --- | --- |
| 1 | CI 加 `typecheck`、修 seed、`src/test/setup.ts` 改 localhost、加 dependabot | `ci.yml` 全绿且 E2E 转阻塞 | 6.4 |
| 2 | `src/env.ts` 环境变量校验 | 缺配在启动期报错而非首次请求 | 6.2 |
| 3 | PV 写路径瘦身：去 `getServerSession`、合并 `findFirst`、op-log 改 `after()` | `/api/analytics/visit` 从 3 写 + 1 读降到 1 写 | 2.1、2.2 |
| 4 | 错误响应收口 24 处 + lint 规则 | `grep 'NextResponse.json({ error'` 在 `src/app/api` 为 0 | 6.1 |
| 5 | Like 原子 toggle + 写 `userId` | 并发双击无 500；登录用户点赞绑账号 | 5.2 |
| 6（并行） | 删 5 个未使用依赖、`sitemap` 改 ISR、搜索 `keepPreviousData` | `pnpm install` 体积下降；sitemap 不再每次打 4 次库 | 2.9、2.4、4.7 |

### 阶段二（第 3–6 周）：数据与一致性

| 顺序 | 条目 | 产出 | 对应小节 |
| --- | --- | --- | --- |
| 1 | `rate_limit_entries` 入 schema + `migrate diff` 漂移检测 | CI 能发现 schema/迁移不一致 | 5.4 |
| 2 | 6 处 `status String` → enum（按 5.1 顺序分 3 批） | schema 内状态列全部有约束 | 5.1 |
| 3 | `visit_daily_stats` + retention cron + `viewCount` 异步回写 | 后台热门文章改读聚合表；`visit_logs` 有保留上限 | 5.3、5.7、2.6 |
| 4 | `unstable_cache` + tag 失效替换路径级 revalidate | 设置变更不再逐一失效 15 条路径 | 2.4 |
| 5 | 连接池上调 + 限流迁出数据库（Redis 或 Postgres `UNLOGGED` 表） | 限流不再占用业务连接 | 2.3 |
| 6（并行） | 11 处手写 fetch → SWR；7 个设置面板 → RHF | `useState+useEffect+fetch` 模式在 `src/components` 为 0 | 4.1、4.2 |
| 7 | 结构化日志 + 错误上报 | 生产 5xx 可定位到 requestId | 6.5 |
| 8 | AI 任务 cron 消费者 + 租约 | 部署重启后 `QUEUED` 任务自动恢复 | 6.6 |

### 阶段三（第 7 周起）：体验与长期维护

| 顺序 | 条目 | 产出 | 对应小节 |
| --- | --- | --- | --- |
| 1 | UI 原语收敛到一套 shadcn（先 Button/Input/Badge） | `components/ui` 与 `components/admin/ui` 只剩再导出 | 3.1 |
| 2 | 语义色 token + lint 禁裸色板 | `text-rose-*` 等在业务组件中为 0 | 3.2 |
| 3 | `useUrlFilters` 替换 localStorage 筛选记忆 | 后台列表筛选可分享/可回退 | 4.4 |
| 4 | 编辑器 Cmd+S、拖拽上传、字数统计 | 与 novel 对齐的基本编辑体验 | 4.6 |
| 5 | Newsletter 并发投递 + 批次表 | 千人投递从串行分钟级降到秒级 | 2.10 |
| 6 | JSON-LD + 文章 OG 图兜底 + nonce CSP | 结构化数据校验通过；`'unsafe-inline'` 从 script-src 移除 | 6.8、6.3 |
| 7（持续） | loading/empty 态补齐、a11y lint、ADR、格式化工具 | 每个路由段有 `loading.tsx`；`docs/adr/` 至少 3 篇 | 3.3、3.4、6.7、6.9 |

---

## 8. 不建议做

以下方向在对照过程中都考虑过，结论是"收益不抵成本"或"与项目定位不符"，列出以免反复讨论：

1. **全面迁移到 Server Actions。** 本项目对外暴露 OpenAPI（`lib/ai-interface-catalog.ts`）且所有接口经 `withApiOperationLogging` 审计，Route Handler 是正确选择；taxonomy 同样全部用 Route Handler。只需按 6.9 写一篇 ADR。
2. **引入 i18n 框架（next-intl 等）。** 站点 locale 固定 `zh-CN`（`blog-settings.ts:15,61`），文案全部中文，没有多语言需求；框架会给每个组件增加 `useTranslations` 噪音。
3. **用 Redis/BullMQ 替换 `AiTask` 表做队列。** `AiTask/AiTaskItem` 已是持久化、可查询、有后台页面的队列，缺的只是消费者（6.6）。新增一个有状态中间件会让部署从"一个 Postgres"变成两个。
4. **把 Markdown 编辑器换成块编辑器（novel/Tiptap）。** 内容模型是 Markdown 字符串，AI 流水线（摘要/SEO/日报成文）都围绕 Markdown；换内核意味着存量内容迁移与 AI 提示词重写。从 novel 借鉴的只是交互细节（4.6）。
5. **整体重写 UI 到新设计系统。** 3.1 的收敛是"把四层并成一层 shadcn"，不是换设计语言；公共页的 OKLCH + `--hue` 主题系统（`globals.css:113`）是项目特色，保留。
6. **squash 或重命名历史迁移。** 31 个迁移目录命名宽度不一（5.6）是美观问题；重命名会让已部署环境的 `_prisma_migrations` 失配，squash 会丢失部分唯一索引的手写 SQL 上下文。
7. **用 Tinybird/ClickHouse 替换 `VisitLog`。** dub 的量级（每天数百万点击）才需要列式存储；本项目日 PV 在千到万级，PostgreSQL + 日聚合表（5.3）足够。若未来确实需要独立分析，更合理的选项是自托管 umami 并以 tracker 脚本接入，而非自研。
8. **微服务拆分或独立 AI worker 服务。** 单体 Next.js + GitHub Actions cron 的运维成本已经与项目规模匹配；6.6 的 cron 消费者方案不需要新进程。
9. **把 `DATABASE_POOL_MAX` 直接调到 20。** 2.3 建议上调，但需先确认部署目标的 Postgres `max_connections` 与是否有 PgBouncer；盲目上调会在多实例部署时耗尽连接。
10. **为所有 Prisma 模型生成 zod schema（cal.com 的 `zod-prisma-types`）。** 本项目的 `lib/validation.ts` 手写校验层已覆盖全部写入口且有契约测试；生成器会引入一份与手写层重叠的真源。

---

## 附录 A：统计口径与复现命令

所有计数均在 `main` @ `acfecbe` 的工作树上以下列命令得出，排除 `__tests__`、`*.test.ts(x)`、`e2e/` 与 `node_modules/`。重跑可验证本文数字是否过期。

| 指标 | 命令 | 结果 |
| --- | --- | --- |
| 客户端组件比例 | `grep -rl "^['\"]use client['\"]" src --include='*.tsx' \| wc -l` / `find src -name '*.tsx' \| wc -l` | 169 / 502 |
| 手写 fetch 组件 | `grep -rlE "await fetch\(\|fetch\(" src/components src/app --include='*.tsx' --include='*.ts' \| grep -v __tests__ \| grep -v client-api` | 13 个文件 |
| 未用 RHF 的表单 | `grep -rL "useForm" $(grep -rl "<form" src/components src/app --include='*.tsx' \| grep -v __tests__)` | 11 个文件 |
| 裸色板 class | `grep -rhoE "\b(text\|bg\|border\|ring)-(rose\|red\|amber\|emerald\|green\|sky\|blue\|yellow\|orange)-[0-9]{2,3}\b" src/components src/app --include='*.tsx' \| sort \| uniq -c \| sort -rn` | 119 处 |
| 十六进制颜色 | `grep -rhoE "#[0-9a-fA-F]{6}\b" src/components src/app --include='*.tsx' \| wc -l` | 29 处 |
| a11y 属性 | `grep -rho "aria-label" … \| wc -l`；同法统计 `role=`、`focus-visible`、`aria-live`、`skip` | 114 / 49 / 88 / 0 / 1 |
| Route Handler 总数 | `find src/app/api -name route.ts \| wc -l` | 91 |
| 使用 `toErrorResponse` 的路由 | `grep -rl toErrorResponse src/app/api --include=route.ts \| wc -l` | 86 |
| 手拼错误 JSON 的路由 | `grep -rlE "NextResponse\.json\(\s*\{\s*error" src/app/api --include=route.ts \| wc -l` | 24 |
| `console.*` 调用 | `grep -rnE "console\.(log\|error\|warn\|info)" src/lib src/app src/components --include='*.ts' --include='*.tsx' \| grep -v __tests__ \| grep -v '\.test\.' \| wc -l` | 51 |
| `process.env` 直读 | `grep -rho "process\.env\.[A-Z_]*" src/lib \| sort -u \| wc -l` | 37 |
| 测试文件 / E2E / 契约测试 | `find src -name '*.test.ts*' \| wc -l`；`ls e2e/*.spec.ts \| wc -l`；`grep -rl "contract" src --include='*.test.ts' \| wc -l` | 289 / 31 / 13 |
| `loading.tsx` / `error.tsx` / `not-found.tsx` | `find src/app -name 'loading.tsx' \| wc -l` 等 | 2 / 3 / 2 |
| `status String` 列 | `grep -n "status *String" prisma/schema.prisma` | 6 处（233/271/400/491/520/778） |
| `onDelete` 策略 | `grep -o "onDelete: [A-Za-z]*" prisma/schema.prisma \| sort \| uniq -c` | Cascade 23 / SetNull 9 |
| `Timestamptz` 使用 | `grep -c Timestamptz prisma/schema.prisma` | 0 |
| 迁移目录数 | `ls prisma/migrations \| grep -c '^[0-9]'` | 31 |

参考项目的文件与行号均在 2026-10-20 通过 GitHub raw 内容核验；上游后续改动可能使行号漂移，核验时请以 commit 时间点为准。
