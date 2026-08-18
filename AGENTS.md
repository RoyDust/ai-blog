# AGENTS.md

This file provides guidance to Codex and other coding agents when working with code in this repository.

## 项目概述

Inkforge 是一个使用 Next.js 16 构建的 AI 内容平台：在博客前台（注册登录、文章、评论、点赞收藏、分类标签、系列、暗黑模式）之上，集成了 AI 写作与选题流水线（摘要 / SEO / 封面生成、AI 新闻自动成文、AI Agent 接入、AI 任务中心）和可观测运营后台（操作日志、站内通知、阅读分析、Newsletter）。

## Agent skills

### Issue tracker

Issues and PRDs are tracked in GitHub Issues for `RoyDust/ai-blog`. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the default five-label triage vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

This is a single-context repo; domain docs are read from root-level `CONTEXT.md` and `docs/adr/` when present. See `docs/agents/domain.md`.

## 常用命令

```bash
pnpm dev            # 启动开发服务器 (http://localhost:3000)
pnpm build          # 生产构建
pnpm lint           # ESLint 检查

pnpm test           # Vitest 单元/组件测试 (vitest run)
pnpm vitest run src/lib/__tests__/posts.test.ts   # 运行单个测试文件
pnpm test:ui        # Vitest watch 模式
pnpm test:e2e       # Playwright E2E (testDir: e2e/, 自动启动/复用 dev server)

pnpm ai-news:check  # 检查 AI 新闻流水线就绪状态
```

### 数据库 (Prisma)

```bash
pnpm prisma migrate dev    # 创建/应用迁移 (prisma/migrations 已纳入版本管理)
pnpm prisma generate       # 生成 Prisma Client
```

种子与运维脚本在 `scripts/` (seed-categories.cjs、seed-tags.cjs、seed-mock-posts.cjs、create-ai-api-token.mjs 等)。

## 技术栈

Next.js 16 (App Router, 开启 viewTransition 实验特性) + React 19 + TypeScript + Tailwind CSS v4 + PostgreSQL + Prisma 7 (`@prisma/adapter-pg` 驱动适配器) + NextAuth v4 (JWT 会话) + pnpm。客户端数据请求统一走 SWR（`lib/client-api.ts`），表单用 React Hook Form + Zod，动画用 motion，UI 基于 Radix/shadcn 风格组件 (`components.json`)。

## 代码架构

### 路由分区 (src/app)

- `(public)/` — 前台：首页、posts、categories、tags、series、search、archives、bookmarks、guides、about、contact
- `(auth)/` — 登录、注册
- `admin/` — 运营后台：posts、categories、tags、series、comments、covers、ai (模型/任务)、ai-news、newsletter、notifications、logs、settings、taxonomy、topic-guides
- `api/` — Route Handlers，按域划分；含 `/api/ai/*` (AI Agent 接入，OpenAPI 目录见 `lib/ai-interface-catalog.ts`)、`/api/cron/*` (定时任务)、`/api/internal/*` (内部摄取)
- `profile/`、`write/` — 个人资料与创作入口

### 权限边界

根目录 `middleware.ts` 统一拦截 `/admin/*` 与 `/api/admin/*`：校验 NextAuth JWT 且 `role === 'ADMIN'`，页面跳登录、API 返回 401/403，并把被拒请求写入操作日志。`/api/cron/*` 与 `/api/internal/*` 由同一 middleware 按"精确路径 → 密钥"注册表做内部密钥网关兜底（见下文 API 路由约定）。

### API 路由约定

- 业务代码抛 `lib/api-errors.ts` 中的语义化错误 (`ValidationError` / `UnauthorizedError` / `NotFoundError` / `ConflictError` 等)，由 `toErrorResponse` 统一落成响应，不要在 route 里手拼错误 JSON
- 鉴权用 `lib/api-auth.ts` 的 `requireSession()` / `requireAdminSession()`，它们同时为操作日志登记 actor
- 服务端入参校验用 `lib/validation.ts` 的手写校验层（`readString`/`assert*` 积木，抛 `ValidationError`）；客户端表单用 Zod 做 UX 校验（权威校验始终在服务端）
- 内部接口（`/api/cron/*`、`/api/internal/*`）必须经 `lib/internal-secrets.ts` 的 `requireInternalSecret` / `isValidInternalSecret` 校验（日志摄取接口用 `api-operation-log-ingest-secret.ts` 的 `isValidOperationLogIngestSecret`）；密钥比较统一走 `safeSecretEquals`（常量时间），禁止 `===` 直比。middleware 对这些前缀下的路由使用精确路径密钥注册表兜底——新增内部路由必须在 `middleware.ts` 的 `INTERNAL_PATH_SECRETS` 显式登记，否则 fail closed（503），相似前缀不得继承既有密钥。语义约定：密钥错误 401、密钥缺配 503、连续失败触发 429 限流

### 业务逻辑层 (src/lib)

绝大多数业务逻辑在 `src/lib`（90+ 模块），route handler 和页面保持薄。主要域：AI 流水线 (`ai-news-*`、`ai-tasks`、`ai-models`、`post-summary*`、`ai-cover-image`)、内容 (`posts`、`taxonomy`、`recommendations`)、运营 (`newsletter*`、`notifications`、`analytics`、`reading-*`、`api-operation-log*`)、基础设施 (`prisma`、`cache`、`rate-limit`、`seo`、`security-headers`、`qiniu-server`)。

### 前端数据层与表单约定

- **客户端取数**：列表用 `useSWR(urlKey, apiFetcher, { keepPreviousData: true, revalidateOnMount: true })`，key 为完整 URL 字符串；轮询用 `refreshInterval`；变更操作用 `apiMutate` 成功后 `mutate()` 失效。禁止手写 `useState+useEffect+fetch` 状态机与 requestId 竞态防护。黄金参考：`components/admin/logs/ApiOperationLogsClient.tsx`（列表）、`components/admin/posts/hooks/usePostsList.ts`（复杂列表）。
- **错误契约**：`lib/client-api.ts` 的 `apiFetcher`/`apiMutate` 统一解析响应——HTTP 非 2xx 或业务 `{ success: false }` 抛 `ApiRequestError`；错误文案经 `toErrorMessage` 收敛。服务端英文默认文案（Unauthorized / Forbidden / Internal server error 等）由 `admin-api-client.ts` 的 `getApiErrorMessage` 统一映射为中文，网络层异常（TypeError）由 `toErrorMessage` 收敛为中文；后台接口 401 由 `AppProviders` 的 SWR `onError`（`handleGlobalSwrError`）统一跳转登录弹层（仅拦 `/api/admin` 前缀），局部 SWR `onError` 必须先调用 `handleGlobalSwrError(error, key)`，不可覆盖该全局行为。分工：字段级错误走表单内联（shadcn `FormMessage` 或自定义 Input 的 `error` prop），请求级错误走 `toast.error`；登录表单是例外，保留内联错误 banner。
- **表单**：React Hook Form + `zodResolver` + zod schema（与组件同文件）；提交态用 `isSubmitting`；错误文案中文。公共页保留现有视觉组件（`components/ui`），后台表单用 shadcn `Form` 组件。黄金参考：`app/(public)/contact/ContactForm.tsx`（公共页）、`app/(auth)/register/page.tsx`（zod refine）。
- **列表筛选记忆**：查询词/状态过滤/分页的 localStorage 持久化统一走 `src/hooks/useFilterMemory.ts`（`useFilterMemory` + `readFilterMemory`/`writeFilterMemory`/`readPositiveInteger`），字段级合法值校验由调用方注入 validate，禁止各列表自行复制读写脚手架。黄金参考：`components/admin/posts/hooks/usePostsList.ts`、`app/admin/comments/page.tsx`
- **后台文章工作台**：`components/posts/AdminPostWorkspace.tsx` 只做状态编排与布局装配，面板内容拆在独立展示组件（`WorkspaceHeader`/`PublishSettingsPanel`/`MetadataEditor`/`ArticleInfoPreviewModal`/`AiFieldButton`，共享类型见 `workspace-types.ts`），新增面板沿用同一模式，不要回流为主组件内联 JSX
- **后台设置页 / AI 日报控制台**：`AdminSettingsClient.tsx` 与 `admin/ai-news/page.tsx` 只做状态编排与面板装配——settings 各 tab 拆在 `*SettingsPanel.tsx` + `SettingsTablist`（类型/schema 见 `settings-shared.ts`）；ai-news 数据层在 `hooks/useAdminAiNews.ts`、展示在 `AiNewsRun*Panel.tsx`。边界由 `admin-panel-boundary-contract.test.ts` 契约测试锁定
- **react-hooks 新规则**：不在 effect 体内同步 setState；渲染期条件 setState（"渲染期调整"模式）与事件回调/定时器回调中的 setState 是允许的；不在渲染期读取 ref。
- **SWR 测试**：组件测试需在 `beforeEach` 中 `await clearSwrCache(() => true, undefined, { revalidate: false })`（SWR 全局缓存跨用例共享）；同 key 多用例优先用测试侧 `<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>` 隔离。fetch mock 需带 `ok: true`（client-api 严格校验）。错误态测试注意：SWR 在请求完成后按 `dedupingInterval`（默认 2000ms）才释放 FETCH 并发标记，前序用例结束 <2s 内的同 key 挂载会被判定为"已有进行中请求"而跳过 fetch——可等待标记过期或改用新 key。禁止为迁就测试在生产 hook 中配置 `dedupingInterval: 0`。

### Prisma 使用约定

- 必须从 `@/lib/prisma` 导入共享客户端，不要自行 `new PrismaClient()`。该模块通过 Proxy 实现单例 + 热重载复用，且在缺少 `DATABASE_URL` 时（如 Docker 构建期）导入安全、调用时才报错
- 数据模型分四组：账户 (`User`/`Account`/`Session`)、内容 (`Post`/`Category`/`Tag`/`Series`/`Comment`/`Like`/`Bookmark`/`TopicGuide`)、AI (`AiModel`/`AiTask`/`AiApiClient`/`AiNewsRun`/`AiNewsSource`/`AiNewsCandidate`/`AiTopic`/`CoverAsset` 等)、运营 (`Notification`/`VisitLog`/`ReadingEvent`/`ApiOperationLog`/`SystemSetting`/`Newsletter*`)
- 内容类模型（文章、分类、标签、系列、评论、封面）使用软删除 (`deletedAt`)，查询时注意过滤

### 缓存与重验证

公共页面 ISR 统一用 `lib/cache.ts` 的 `PUBLIC_REVALIDATE_SECONDS` (300s)；内容变更后必须调用该模块的 revalidate 辅助函数（按文章/分类/标签/系列路径精确失效），相关行为有契约测试约束 (`src/app/__tests__/public-layout-cache.test.ts`)。

### 路径别名

`@/*` → `./src/*`（tsconfig 与 vitest 均已配置）。

## 测试

- 单测/组件测试：Vitest + jsdom + Testing Library，setup 文件 `src/test/setup.ts`；测试文件放在被测代码旁的 `__tests__/` 目录，匹配 `src/**/*.test.ts(x)`
- E2E：Playwright，仅 chromium、单 worker、串行，baseURL `http://127.0.0.1:3000`，会复用已运行的 dev server
- 项目大量使用"契约测试"约束页面缓存配置、API 错误格式等横切行为，修改相关约定时同步更新对应测试

## 环境变量

完整模板见 `.env.example`。必填：`DATABASE_URL`、`AUTH_SECRET`、`NEXTAUTH_SECRET`、`NEXTAUTH_URL`、`NEXT_PUBLIC_SITE_URL`。可选组：GitHub OAuth (`AUTH_GITHUB_*`)、七牛云图片上传 (`QINIU_*`)、AI 模型 (`AI_OPENAI_COMPAT_*` 优先，`DASHSCOPE_*` 为兜底)。

## 文档

- `README.md` — 功能总览、环境变量表、部署说明（最新）
- `docs/plans/`、`docs/implementation/` — 历史设计与实施文档，按日期命名
- `docs/integrations/ai-authoring-api.md` — AI 写作 API 对接文档
- `ARCHITECTURE.md` 是项目初期 (2026-03) 的设计稿，与现状有偏差（如 NextAuth 版本、目录结构），以代码为准
- `CLAUDE.md` 是给 Claude Code 的同类说明文件，更新本文件时注意两者是否需要同步
