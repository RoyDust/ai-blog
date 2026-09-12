# Inkforge 前后端架构完整分析报告（2026-08-15）

> 分析方法：本人对关键配置与核心模块做基线勘察（middleware、prisma 单例、cache、rate-limit、错误契约、部署链路等），并派出三个并行子代理分别深挖前端、后端/数据层、基础设施/安全/工程质量；本文档为三方结论交叉核验后的汇总。全程只读，未修改任何代码。
>
> 延续文档：`docs/2026-05-10-open-source-blog-benchmark-improvement-analysis.md`（产品视角），本文聚焦工程架构视角。

---

## 一、总体评价

**这是一个架构意识明显高于同规模个人/小团队项目的工程**：分层纪律（薄 route + 厚 lib）、类型安全、契约测试文化、缓存失效机制、密钥处理细节等都比一般内容站成熟。但当前形态呈现一个清晰的分水岭：

- **服务端/渲染层：设计优秀。** RSC 边界、统一 select 结构、语义化错误、Prisma 单例、ISR + 精确失效、AI 流水线的编排分层，都体现了深思熟虑。
- **客户端增强层：偏手工。** 表单、数据请求、后台页面缺少统一抽象，导致巨型客户端组件与手写状态机堆积，可维护性逐步下降。
- **安全与运维基线：有明确短板。** 生产站 TLS/HSTS/CSP 收紧、cron/internal 防护面、密钥卫生是当前最值得优先投入的三件事。

一句话：**“核心读写链路健康，客户端工程化与生产安全基线是下一阶段的主要矛盾。”**

---

## 二、架构现状

### 2.1 总体分层与调用关系

```
┌─────────────────────────────────────────────────────────────┐
│ 浏览器                                                        │
├──────────────┬──────────────────────┬───────────────────────┤
│ 公共前台      │ 运营后台 admin/       │ AI Agent 客户端        │
│ (public) RSC │ 两种模式并存(见 4.x)  │ (外部系统)             │
└──────┬───────┴──────────┬───────────┴───────────┬───────────┘
       │ 服务端直查 Prisma  │ fetch → Route Handlers │ Bearer token
       ▼                  ▼                        ▼
┌──────────────────────────────────────────────────────────────┐
│ middleware.ts — 统一拦截 /admin/* 与 /api/admin/*             │
│   (JWT + role=ADMIN 校验；拒绝请求回写操作日志)                │
├──────────────────────────────────────────────────────────────┤
│ src/app/api — 86 个 Route Handler（薄）                       │
│   /api/public /api/admin /api/ai /api/cron /api/internal       │
├──────────────────────────────────────────────────────────────┤
│ src/lib — 90+ 业务模块（厚）                                  │
│   内容(posts/taxonomy/...) AI 流水线(ai-news-*/ai-tasks/...)  │
│   运营(newsletter*/notifications/analytics/...)               │
│   基础设施(prisma 单例/cache/rate-limit/security-headers/...) │
├──────────────────────────────────────────────────────────────┤
│ Prisma 7 (@prisma/adapter-pg, 共享单例) → PostgreSQL          │
└──────────────────────────────────────────────────────────────┘
```

- 规模：`src/lib` 161 文件、`src/app` 277 文件、`src/components` 266 文件；43 个数据模型/枚举，schema 声明 109 处索引/唯一约束（另含迁移 SQL 手写的搜索索引与部分唯一索引，合计 131 条 CREATE INDEX 语句）；254 个 Vitest 测试文件；最大 lib 模块 843 行（`ai-news-run-flow.ts`），最大组件 945 行（`AdminPostWorkspace.tsx`）——**无上帝模块/上帝组件失控**。*（数字为 2026-08-15 晚修订口径，随并行开发持续增长。）*
- 客户端/服务端边界：146/697（21%）文件带 `use client`，集中收敛在 `components/shadcn`、`components/admin`、`components/blog`，公共页面以 RSC 为主。
- 数据流模式：公共页 RSC 直查 Prisma（不经过自身 API），客户端写操作走 Route Handler，**没有使用 Server Actions**——单一路径，一致性尚可。
- 部署：GitHub Actions（ci / deploy / daily-ai-news / publish-scheduled 四条工作流）+ Docker 多阶段构建 + SSH/rsync 软链发布（Capistrano 风格），`pnpm start`（非 standalone）。

### 2.2 关键机制（现状速写）

| 关注点 | 现状 |
|---|---|
| 鉴权 | NextAuth v4 JWT；`middleware.ts` 拦 `/admin`、`/api/admin`；`requireSession/requireAdminSession` 统一 API 鉴权并登记操作日志 actor |
| 错误契约 | `lib/api-errors.ts` 语义化错误 + `toErrorResponse` 统一落成；Prisma 冲突/缺表/连接失败单独收口 |
| 入参校验 | `lib/validation.ts` **手写校验层**（readString/assertLength 等积木），并非文档所称的 Zod |
| 数据访问 | `lib/prisma.ts` Proxy 单例：热重载复用、模型委托校验、构建期缺库安全降级、连接池签名轮换 |
| 缓存 | 公共页 `revalidate=300`；`revalidatePublicContent` 按文章/分类/标签/系列路径精确失效；有契约测试约束 |
| 限流 | 内存/数据库双驱动（生产默认数据库），按 scope 分层（auth 5/min 到 search 60/min） |
| 软删除 | 内容类模型 `deletedAt` 软删，查询普遍过滤 |
| AI 流水线 | 编排层（run-flow/draft-flow）与纯函数子模块（fetch/parse/dedupe/score/enrich/render）分离，可注入 `fetchImpl` 测试 |
| 密钥 | AI token sha256 哈希存储；AI 模型 API key AES-256-GCM 加密入库；newsletter 用 `timingSafeEqual` |
| 测试 | Vitest 单测/组件 247 文件（就近 `__tests__/`）；Playwright E2E 仅 3 文件 4 用例；CI 跑 lint+test+build 三重门禁 |

---

## 三、优点（应继续保持的工程决策）

1. **薄 route + 厚 lib 分层纪律**：86 个 route handler 大多是"鉴权 → 校验 → 调 lib → 统一错误"，业务在 lib 层按域前缀组织（`ai-news-*`、`post-summary*`、`api-operation-log*`），模块图清晰。
2. **Prisma 单例设计精巧**（`lib/prisma.ts`）：dev 热重载复用、按 `Prisma.ModelName` 校验委托、Docker 构建期缺 `DATABASE_URL` 时返回"不可用代理"保证导入安全、连接池参数变化自动换池——这类细节在多数项目里直接被忽略。
3. **契约测试文化**：缓存配置、API 错误格式、CSP、暗黑模式、公开布局等横切行为均有契约测试兜底（`public-layout-cache.test.ts`、`api-operation-log-coverage.test.ts` 等），防止重构破坏约定。
4. **缓存失效机制**：`revalidatePublicContent` 同时处理新/旧 slug、分类、标签、系列的路径清理，且有测试约束，是少见的"写后精确失效"完整实现。
5. **RSC 边界与 React 19 利用**：首页 `Promise.allSettled` 局部降级（`(public)/page.tsx:38`）、文章页 `use()` 消费评论 Promise、async params 用法正确；`getPublicPostSelect()` 统一列表数据形状。
6. **安全细节的亮点**：AI 客户端 token 哈希 + scope + 吊销（`ai-auth.ts`）、模型 API key 加密存储（`ai-models-crypto.ts`）、SQL 全参数化（`rate-limit.ts:50` 的 `$1/$2`）、IP 哈希、日志脱敏、`timingSafeEqual`（newsletter）。
7. **数据模型索引充分**：schema 声明 109 处索引/唯一约束（另有迁移 SQL 手写的 pg_trgm 搜索索引与软删除部分唯一索引），覆盖列表查询、软删过滤、去重等热点，说明 schema 是"想过的"。
8. **部署链路稳健**：`deploy-remote.sh` 先 `migrate deploy` 再起新容器、镜像预构建 + 失败回退、零停机软链切换；CI 用独立 PostgreSQL 服务跑真实构建。

---

## 四、问题清单（按严重程度排序）

> 每条均经交叉核验，附具体文件与行号证据。

### P0 — 高风险 / 高收益，建议近期处理

**P0-1 表单与数据层缺少统一抽象（前端工程化债）**
- 文档（AGENTS.md/CLAUDE.md）宣称"表单用 React Hook Form + Zod、入参校验用 Zod"，**实际全项目仅 `ContactForm.tsx` 一处使用 RHF+Zod**；`lib/validation.ts` 是手写校验层；登录/注册/文章编辑器全部手写 `useState`，校验散落 `if`。
- 客户端无请求库：无 SWR/React Query/自建 hook，`admin/posts/page.tsx` 单文件 **1250+ 行**整页 `use client`，15+ 状态与删除/发布/批量/摘要轮询逻辑内联；`useInfinitePosts.ts` 用 `requestIdRef` 手写防竞态。
- 后果：每个后台页各写一套 loading/error/竞态处理，行为不一致、不可复用、几乎不可测试。
- 建议：① 引入轻量数据请求层（SWR 或基于 `admin-api-client.ts` 扩展的 `useApiQuery`）；② 拆分 `admin/posts/page.tsx`（hook + 表格/工具栏/批量操作子组件）；③ 登录/注册/编辑器迁到 RHF+Zod，或**修正文档**承认手写校验层的现状并保持统一。

**P0-2 软删除 × 唯一约束冲突（数据模型级缺陷）**
- `Post.slug`、`Series.slug`、`Category.name/slug`、`Tag.name/slug` 均为 `@unique`（`prisma/schema.prisma:152,213,691-692,705-706`），但软删只写 `deletedAt`。**软删后重建同名条目必然触发 P2002**，`toErrorResponse` 会落成 409 "Conflict"，用户无法理解原因。
- 建议：① 部分唯一索引（Postgres partial unique index，如 `WHERE "deletedAt" IS NULL`）——需要迁移现有数据；② 或采用"slug 回收/重命名"策略（软删时追加时间戳后缀）；③ 至少把该场景的 P2002 映射为明确的业务提示"该 slug/名称已被历史内容占用"。

**P0-3 cron / internal 接口防护面薄弱（后端安全）**
- `middleware.ts` matcher 只覆盖 `/admin/:path*` 与 `/api/admin/:path*`（`middleware.ts:119-121`），**`/api/cron/*` 与 `/api/internal/*` 不在统一拦截面内**，保护全靠各 handler 自检。
- cron secret 校验是非常量时间比较（`cron/ai-news/route.ts:19` `token !== configuredSecret`；`cron/publish-scheduled/route.ts:24`），而 newsletter 已用 `timingSafeEqual`（`newsletter.ts:94`）——同一安全目标两种实现。
- 内部日志摄取密钥未配置时**回退到 AUTH_SECRET**（`api-operation-log-ingest-secret.ts:6`），会话签名密钥与内部接口密钥复用，轮换 AUTH_SECRET 会同时破坏两边。
- 建议：① 统一用 `crypto.timingSafeEqual`；② 独立 `OPERATION_LOG_INGEST_SECRET`，去掉 AUTH_SECRET 回退；③ 把 `/api/cron`、`/api/internal` 纳入 middleware 统一防护（或抽取共享 `requireInternalSecret()` helper）；④ 生产环境密钥缺失时**快速失败**而非静默降级。

**P0-4 生产安全基线：TLS / HSTS / CSP / Cookie（基建）**
- 依据 `.env` 与 CI 工作流：`NEXTAUTH_URL` 与 `NEXT_PUBLIC_SITE_URL` 为 **http** 地址；`security-headers.ts` 无 `Strict-Transport-Security`、CSP 无 `upgrade-insecure-requests`；`auth-cookies.ts:5-16` 在 http 配置下**不给会话 cookie 加 Secure**——若线上接入层未终结 TLS，会话 token 明文传输可被窃取。
- CSP 实际为 `script-src 'self' 'unsafe-inline'`（dev 加 `unsafe-eval`）、`img-src http: https:`、`connect-src https:`（`security-headers.ts:12-24`），XSS 纵深防御被显著削弱。
- 建议：① 全站启用 HTTPS（前置 nginx/caddy 终结或直接改站地址），同步把 `NEXTAUTH_URL/SITE_URL` 改为 https 使 Secure cookie 生效；② 安全头加 `Strict-Transport-Security: max-age=31536000; includeSubDomains` 与 CSP `upgrade-insecure-requests`；③ 中长期用 nonce/hash 方案去掉 `unsafe-inline`，`img-src/connect-src` 收敛白名单。

**P0-5 密钥卫生（基建）**
- 本地 `.env` 含真实生产密钥（DB/GitHub/七牛/DashScope）；`AI_NEWS_CRON_SECRET` 为**可猜测的固定字符串**；`NEXTAUTH_SECRET` 未替换为强随机值；`.gitignore` 只挡 `.env`（第 40 行），`.env.local`/`.env.production` 等变体未被忽略。
- 建议：① 轮换全部真实密钥（尤其 cron secret 改为强随机）；② `.gitignore` 改为 `.env*` + `!.env.example`；③ 增加占位符检测——已有 `auth-secret.ts:13` 的检测，可推广到 `AI_NEWS_CRON_SECRET` 等。

**P0-6 鉴权/校验/错误处理入口不一致（后端一致性）**
- 越权面不统一：bookmark 路由用 `getServerSession` 手写鉴权绕过 `requireSession`（`api/posts/[slug]/bookmark/route.ts:19-25`），丢失操作日志 actor 登记。
- 错误契约不统一：`api/posts/route.ts:30-35`、`api/posts/[slug]/route.ts:68-72,84-90` 手拼 404/500 JSON，绕过 `toErrorResponse`；全项目 18 处 `console.error` 吞错，无 requestId 贯穿（`x-request-id` 只在 middleware 拒绝路径存在）。
- 建议：① 所有 route 统一走 `requireSession` + 抛语义化错误 + `toErrorResponse`；② 用 `withApiOperationLogging` 统一生成 requestId 并透出到错误日志。

### P1 — 中风险，建议中期处理

**P1-1 `getBlogSettings()` 无渲染级去重，单次渲染重复查库**
- 44 处调用点；root layout 单文件调用两次（`app/layout.tsx:44,94`）、文章页 `generateMetadata` + 页面主体各一次、`(public)/layout` 再一次——每页渲染 3~5 次相同 `$queryRawUnsafe`（`blog-settings.ts:416-437`），仅靠 ISR 缓解。
- 建议：用 React `cache()`（或 `unstable_cache` + revalidate）包裹，同一请求内去重，成本极低、收益明确。

**P1-2 多套 UI 体系并存（前端）**
- `components/shadcn/ui`（60+ 组件）、自定义 `components/ui`（Card/Input/Toaster）、`components/admin/ui`、`components/admin/primitives` 四层共存；登录用自定义 Button/Input，后台用 shadcn 同名组件，视觉与行为割裂。
- 建议：定单一 shadcn 体系，逐步迁移自定义 `ui/` 的少量封装，删除重复实现。

**P1-3 AI 新闻源抓取无超时/重试（后端可靠性）**
- `runDailyAiNews` 注入的 `fetchImpl` 就是裸 `fetch`（`ai-news-run-flow.ts:569,619`）；`ai-news-fetchers.ts` 抓取路径没有任何 `AbortSignal`/超时（对照：`ai-cover-image.ts:97`、`post-summary.ts:158` 都有 `AbortSignal.timeout`）。**一个挂起的 RSS 源可让整次日报运行无限期卡住**，且该运行是 `activeRuns` Set 内存态 + GitHub Actions 轮询最多 45×10s，超时后运行仍在服务器后台悬挂。
- 同类问题：DashScope 摘要轮询固定 24×5s 无 jitter/指数退避（`post-summary.ts`）；外部 AI 调用普遍只有单次超时、无重试。
- 建议：在 source fetch 层统一加 `AbortSignal.timeout(15~30s)` + 有限重试 + 每源独立失败记录（`failures` 数组已有，补上超时归类）；轮询加退避。

**P1-4 浏览量双计（数据准确性）**
- `viewCount` 在两个入口分别 `increment: 1`：客户端 analytics 信标（`api/analytics/visit/route.ts:83`）与文章详情 API GET（`api/posts/[slug]/route.ts:75-78`）。若文章页同时触发两者（当前架构下大概率如此），**单次阅读浏览量 +2**。
- 建议：明确唯一计数入口（建议只留 analytics 信标，配合 `ArticleReadTracker` 的防抖/去重），详情 GET 改为纯读；存量数据偏差可接受或用 VisitLog 重建。

**P1-5 Markdown 渲染无显式 sanitize（前端安全纵深）**
- `(public)/posts/[slug]/page.tsx:353` 与 `MarkdownEditor.tsx:294` 的 `react-markdown` 仅配 `remark-gfm/rehype-highlight`，无 `rehype-sanitize`、无 `urlTransform`（`javascript:` 链接过滤）、外链无 `rel="nofollow noopener"`。
- 建议：加 `rehype-sanitize` + 自定义 `urlTransform` + 外链 rel 处理；编辑器预览与正文共用同一渲染管线。

**P1-6 限流键可伪造 + 内存限流无淘汰（后端）**
- `getRateLimitKey` 直接取 `x-forwarded-for` 首个 IP（`rate-limit.ts:128-132`），若应用直连暴露（当前 compose 绑 `127.0.0.1:3000` 依赖前置代理）或代理未清洗该头，可伪造绕过。
- `createMemoryRateLimiter` 的 Map 无淘汰（`rate-limit.ts:17`），长期单实例运行缓慢增长（生产默认走数据库驱动，风险降级）。
- 建议：在可信代理层统一覆写/丢弃非信任 `x-forwarded-for`；内存限流加定期清理或上限。

**P1-7 Docker 构建与 ISR / DB 依赖冲突（基建）**
- 公共页 `revalidate=300` 会静态预渲染，文章页 `generateStaticParams`（`(public)/posts/[slug]/page.tsx:84-97`）触库（失败吞错返回 `[]`）；但 `Dockerfile` 构建期只传 `NEXTAUTH_URL/NEXT_PUBLIC_SITE_URL`，无 `DATABASE_URL`——构建产物与 CI（带 DB）不一致，文章页在 Docker 构建下退化为纯动态渲染。
- 建议：二选一——① 明确"构建期不触库"约定：公共页在构建期走动态兜底（已是事实），文档化并在 CI 同样不提供 DB 做一次对齐构建；② 或改用 `output: 'standalone'` + 运行时 DB。同时 `generateStaticParams` 应显式注释其退化行为而非静默吞错。

**P1-8 环境变量文档缺失（基建）**
- `.env.example` 缺 `AI_NEWS_CRON_SECRET`、`OPERATION_LOG_INGEST_SECRET`、`RATE_LIMIT_DRIVER`、`AI_MODEL_SECRET_KEY`、`DATABASE_POOL_MAX`、`NEXT_IMAGE_ALLOW_LOCAL_IP`、`NEWSLETTER_*` 等十余项实际使用变量（已在代码中核验存在）。
- 建议：补齐并加注释分组；可加一个小测试断言"代码引用的 env 键 ⊆ .env.example"（契约测试风格，符合项目文化）。

**P1-9 交互接口 check-then-act 竞态（后端）**
- bookmark/like 的 toggle 是"查存在→删除/新建"两步（`bookmark/route.ts:40-64`、`like/route.ts:27-44`），并发双击可产生 P2002（被兜底为 409）或双写窗口。
- 建议：用 `upsert/deleteMany` 原子化，或捕获 P2002 幂等处理；点赞对登录用户可考虑绑定 userId（当前只绑 browserId，`like/route.ts:29-30`——清 cookie 即丢赞，属产品决策但需确认有意为之）。

**P1-10 AI 任务计数 N+1 与串行重算（后端性能）**
- 每完成一个任务 item 就调用 `refreshAiTaskCounts` 全量 findMany + update（`ai-tasks.ts:330-352`）；`post-summary-jobs.ts:218-292` 批量摘要串行执行且每篇重算全量计数——20 篇批量 = 20 次全表重算。
- 建议：完成时统一刷新一次，计数改为事务内 `groupBy` 原子重算；批量任务并行度受限时至少把重算移出循环。

### P2 — 低风险 / 长期项

**P2-1 E2E 覆盖极薄且不进 CI**：`e2e/` 仅 3 文件 4 用例（reader 浏览、author 重定向、admin 重定向），登录/评论/上传/AI 关键路径无覆盖；`ci.yml` 不跑 `test:e2e`。
**P2-2 死依赖未裁剪**：`embla-carousel-react`、`react-resizable-panels` 及部分 shadcn 组件（carousel/resizable/menubar/hover-card）无业务调用。
**P2-3 viewTransition 全站生效**：`globals.css` `navigation: auto` + 620ms 布局帧时长对 admin/auth 等交互页也触发；slug 派生 `view-transition-name` 在同页重复 slug 时可能冲突。建议收敛到前台阅读流并保证名称唯一。
**P2-4 后台两种数据模式并存**：categories/tags/taxonomy/ai/settings 为 RSC 直查，posts/comments/ai-news/newsletter/series/topic-guides 为整页 `use client` 自 fetch——建议统一为"RSC 取数 + 客户端增强"，与 P0-1 数据层建设合并推进。
**P2-5 工程门禁缺口**：无独立 `typecheck`/Prettier 脚本与 `.prettierrc`；`eslint.config.mjs` 忽略 `scripts/*.cjs`；无 `engines`/`packageManager` 字段（node 版本仅 CI/Dockerfile 固定）。
**P2-6 可观测性近乎空白**：无 Sentry/APM/日志聚合，仅散落 `console.error`；建议至少接入 Sentry + 结构化日志（requestId 贯穿已在 P0-6 铺垫）。
**P2-7 构建产物未瘦身**：非 standalone，runner 镜像装全量 prod 依赖并拷贝 `src/tsconfig`；`recharts`/`react-markdown` 等重型依赖未 `next/dynamic` 按需加载；CJK 字体（Noto Serif SC 700+900）首屏体积需评估子集化。
**P2-8 细节卫生**：`rate_limit_entries` 是 schema 外裸表（仅存在于迁移 SQL `202606060003_rate_limit_and_search_indexes/migration.sql`，无对应 model），`prisma db pull` 或新成员维护时易产生认知错位；生产 IP 硬编码于 `daily-ai-news.yml:20`、`publish-scheduled.yml` 等；dev 硬编码回退密钥（`anonymous-actor.ts`、`api-operation-log-ingest-secret.ts:3`）。

**P2-9 任务调度为进程内存态，多实例/重启不安全**：日报 `activeRuns` Set（`cron/ai-news/route.ts:9`）与摘要任务队列（`post-summary-jobs.ts:26,45`）都在进程内存中，重启即丢失运行态、多实例可能重复执行；`AiNewsRun.runDate` 无 DB 唯一约束，创建 run 无冲突守卫（`ai-news-run-flow.ts:633`）。单实例部署下可接受，扩缩容前需改为 DB 驱动状态机（status 状态机 + `ON CONFLICT` 唯一守卫）。同层风险：`taxonomy.ts:25,42` 与 `posts.ts:78-80` 按关系 `_count` 排序/计数，大表下存在慢查询风险，需要时加计数器列或物化统计。

---

## 五、优化路线图（建议推进顺序）

### 阶段一：安全与正确性（1~2 周，不依赖大重构）
1. P0-5 密钥轮换 + `.gitignore` 修正（半小时，立即做）
2. P0-4 HTTPS + HSTS + CSP 收紧 + Secure cookie（取决于接入层，半天~1 天）
3. P0-3 cron/internal 防护统一（timingSafeEqual + 独立 secret + 纳入 middleware）
4. P0-2 软删除唯一约束方案决策与迁移（部分唯一索引，含存量数据清理）
5. P1-4 浏览量单计数入口（半天）+ P1-6 限流键可信代理清洗

### 阶段二：客户端工程化（2~4 周，收益最大的一笔投入）
6. P0-1 数据请求层引入（SWR）+ `admin/posts/page.tsx` 拆分 + 表单层统一（RHF+Zod 或修正文档）
7. P1-2 UI 体系收敛 + P2-4 后台数据模式统一（与 6 合并推进）
8. P1-1 `getBlogSettings` 加 `cache()`（半小时）
9. P1-7 构建/ISR 契约文档化 + P2-7 动态加载与字体优化

### 阶段三：可靠性与纵深（持续）
10. P1-3 新闻源超时/重试 + P1-9 原子化交互接口
11. P1-5 Markdown sanitize + P0-6 错误/鉴权入口统一收口
12. P2-1 E2E 扩充并入 CI、P2-5 门禁补齐、P2-6 可观测性接入

### 暂不建议
- **大改技术栈**（换 ORM、换认证、迁移 App Router 之外）：当前核心链路健康，收益不抵风险。
- **微服务/拆分部署**：单实例 + 数据库限流对当前流量绰绰有余，先补监控再谈扩缩容。

---

## 六、附：文档一致性提醒（2026-08-15 晚复核：三处漂移均已解决）

`AGENTS.md`/`CLAUDE.md` 与代码现状的历史漂移，现状如下：
1. ~~"入参校验用 Zod"~~ → ✅ 已解决：文档已改为"服务端用 `lib/validation.ts` 手写校验层，客户端表单用 Zod 做 UX 校验（权威校验在服务端）"，与代码一致；
2. ~~"表单用 RHF+Zod，实际仅 ContactForm 一处"~~ → ✅ 已解决：LoginForm/register 等表单已完成 RHF+Zod 迁移，文档约定（黄金参考 ContactForm/register）与代码一致；
3. ~~"完整模板见 `.env.example`"~~ → ✅ 已解决：模板已补齐全部变量，并有 `env-example-contract.test.ts` 防回退。

## 七、整改进展（2026-08-15 更新）

阶段一（安全与正确性）执行状态：

| 条目 | 状态 | 说明 |
|---|---|---|
| P0-2 软删除 × 唯一约束 | ✅ 已上线生效 | 迁移已于 2026-08-15 应用到生产并经 DB 级验证（8 部分唯一索引在位、P2002 探针确认），详见 `docs/plans/2026-08-15-soft-delete-unique-fix.md` |
| P0-3 cron/internal 防护 | ✅ 已实施 | `lib/internal-secrets.ts` 常量时间比较 + 独立 `OPERATION_LOG_INGEST_SECRET` + 弱密钥告警；并行会话进一步扩展 middleware 内部密钥网关（fail closed 503） |
| P0-4 TLS/HSTS/CSP | ⚠️ 仓库侧完成 | HSTS 生产下发已加；`upgrade-insecure-requests` 与 img-src 收紧被阻断——图片主机 project.roydust.top 无 https（已核验）。运维步骤见 `docs/deployment/security-hardening-runbook.md` |
| P0-5 密钥卫生 | ⚠️ 仓库侧完成 | `.gitignore` 加固、弱密钥检测、`.env.example` 补齐 + 契约测试；实际轮换需运维执行（runbook 第 1 节，已按 2026-08-15 密钥现状修订） |
| P0-6 鉴权/错误一致 | ✅ 核心路由已收口 | bookmark/posts/github-unlink 走 requireSession + 语义化错误 |
| P1-1 getBlogSettings 去重 | ✅ 已实施 | React `cache()` 请求级去重（vitest 下退化为直调，兼容） |
| P1-4 浏览量双计 | ✅ 已实施 | 详情 GET 改纯读，仅 analytics 信标计数，附防回归测试 |
| P1-8 环境变量文档 | ✅ 已实施 | `.env.example` 补齐全部变量 + env 契约测试（4 种提取模式） |
| 审查闭环 | ✅ 三轮完成 | 第一轮（8 问题已修）→ 第二轮 Grok 4.6 通过 → 第三轮全任务审查有条件通过；待办已在本节与 runbook 消化。全量验证：254 文件 / 955 用例全绿（2026-08-15 晚） |
