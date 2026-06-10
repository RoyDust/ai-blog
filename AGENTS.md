# AGENTS.md

This file provides guidance to Codex and other coding agents when working with code in this repository.

## 项目概述

Inkforge 是一个使用 Next.js 16 构建的 AI 内容平台：在博客前台（注册登录、文章、评论、点赞收藏、分类标签、系列、暗黑模式）之上，集成了 AI 写作与选题流水线（摘要 / SEO / 封面生成、AI 新闻自动成文、AI Agent 接入、AI 任务中心）和可观测运营后台（操作日志、站内通知、阅读分析、Newsletter）。

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

Next.js 16 (App Router, 开启 viewTransition 实验特性) + React 19 + TypeScript + Tailwind CSS v4 + PostgreSQL + Prisma 7 (`@prisma/adapter-pg` 驱动适配器) + NextAuth v4 (JWT 会话) + pnpm。表单用 React Hook Form + Zod，动画用 motion，UI 基于 Radix/shadcn 风格组件 (`components.json`)。

## 代码架构

### 路由分区 (src/app)

- `(public)/` — 前台：首页、posts、categories、tags、series、search、archives、bookmarks、guides、about、contact
- `(auth)/` — 登录、注册
- `admin/` — 运营后台：posts、categories、tags、series、comments、covers、ai (模型/任务)、ai-news、newsletter、notifications、logs、settings、taxonomy、topic-guides
- `api/` — Route Handlers，按域划分；含 `/api/ai/*` (AI Agent 接入，OpenAPI 目录见 `lib/ai-interface-catalog.ts`)、`/api/cron/*` (定时任务)、`/api/internal/*` (内部摄取)
- `profile/`、`write/` — 个人资料与创作入口

### 权限边界

根目录 `middleware.ts` 统一拦截 `/admin/*` 与 `/api/admin/*`：校验 NextAuth JWT 且 `role === 'ADMIN'`，页面跳登录、API 返回 401/403，并把被拒请求写入操作日志。

### API 路由约定

- 业务代码抛 `lib/api-errors.ts` 中的语义化错误 (`ValidationError` / `UnauthorizedError` / `NotFoundError` / `ConflictError` 等)，由 `toErrorResponse` 统一落成响应，不要在 route 里手拼错误 JSON
- 鉴权用 `lib/api-auth.ts` 的 `requireSession()` / `requireAdminSession()`，它们同时为操作日志登记 actor
- 入参校验用 Zod (`lib/validation.ts`)

### 业务逻辑层 (src/lib)

绝大多数业务逻辑在 `src/lib`（90+ 模块），route handler 和页面保持薄。主要域：AI 流水线 (`ai-news-*`、`ai-tasks`、`ai-models`、`post-summary*`、`ai-cover-image`)、内容 (`posts`、`taxonomy`、`recommendations`)、运营 (`newsletter*`、`notifications`、`analytics`、`reading-*`、`api-operation-log*`)、基础设施 (`prisma`、`cache`、`rate-limit`、`seo`、`security-headers`、`qiniu-server`)。

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
