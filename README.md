# Inkforge

<div align="center">

[简体中文](./README.md) | [English](./README.en.md)

**把素材锻造成文章的 AI 内容平台。**

Inkforge 不是只渲染 Markdown 的主题模板，而是把*有阅读质感的博客前台*、*接上 AI 的写作与选题流水线*、*可审计的运营后台*装进同一个 Next.js 应用。

[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-111111?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.3-149ECA?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-7.4.2-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-336791?logo=postgresql)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38BDF8?logo=tailwindcss)](https://tailwindcss.com/)

[在线预览](http://47.98.167.32) · [架构说明](./ARCHITECTURE.md) · [部署指南](./docs/deployment/github-actions-manual-deploy.md) · [项目文档](./PROJECT_DOCS.md)

</div>

## 预览

截图位先预留，后续把图片放进 `docs/assets/readme/` 后替换这里即可。

| 阅读首页 | 文章详情 | AI 任务中心 |
| --- | --- | --- |
| `docs/assets/readme/public-home.png` | `docs/assets/readme/post-detail.png` | `docs/assets/readme/admin-ai-tasks.png` |

## Inkforge 是什么

普通博客项目只解决“把 Markdown 渲染出来”。但长期运营一个内容站，你还要面对选题、写稿、配图、SEO、审稿、发布、评论、订阅、可观测和部署。Inkforge 把这些环节一次性接上，并在能自动化的地方接入 AI：

- **博客前台**：首页、文章、分类、标签、系列、归档、搜索、书签，带阅读进度、目录、代码高亮和暗色模式。
- **AI 写作与选题流水线**：从多源抓取资讯，到去重、打分、选题、成文、审稿、发布，配合 AI 摘要、SEO 和封面生成，并开放给外部 AI Agent。
- **可观测运营后台**：文章 / 分类 / 标签 / 系列 / 评论 / 封面 / AI 模型管理，叠加操作审计日志、站内通知和阅读行为分析。

## 核心能力

### 一、AI 写作与选题流水线（项目核心）

把“AI 能写”落成可运营的链路，而不是一个聊天框：

- **AI 内容辅助**：一键生成文章摘要、SEO 标题 / 描述和封面图；摘要状态机（排队 → 生成中 → 完成 / 失败）可追踪、可重试。
- **AI 新闻日报**：从 RSS、Hacker News、GitHub Releases / Trending、Reddit 抓取候选 → 规范化去重 → AI 打分选题 → 自动成文 → AI 审稿评分 → 发布，支持手动触发与 Cron 定时执行。
- **AI Agent 外部接入**：用作用域化 API Token 让外部 Agent 创建 / 更新草稿（草稿绑定 + OpenAPI 描述 + 元信息端点），把第三方写作 Agent 接进发布流程。
- **AI 任务中心**：所有 AI 操作统一进任务队列，记录请求 / 成功 / 失败计数，支持批量执行、部分失败重试和结果应用，关键节点推送站内通知。
- **AI 模型管理**：在后台配置 OpenAI 兼容模型（默认 DashScope / Qwen 兼容），按能力（摘要 / 封面）指定默认模型并一键测试连通性。

### 二、阅读与互动前台

- 首页与精选区、文章详情、归档、分类、标签、系列、站内搜索、书签页
- 阅读进度、文章目录、代码高亮与行号、暗色模式、移动端目录抽屉、减少动态效果适配
- 匿名点赞、评论与嵌套回复、本地收藏、分享、返回顶部
- RSS、`sitemap.xml`、`robots.txt`、`manifest`、Open Graph 图与 JSON-LD 结构化数据

### 三、内容生产与运营后台

- Markdown 写作工作台与文章编辑器，七牛云图片上传 + 客户端压缩
- 草稿、发布、定时发布、精选、阅读时长、系列归档、软删除与公开路径重验证
- 文章 / 分类 / 标签 / 系列 / 评论后台管理，评论审核（`APPROVED` / `PENDING` / `REJECTED` / `SPAM`）
- 封面图库、系统设置、Newsletter 订阅、联系页配置
- **可观测性**：API 操作审计日志、站内通知中心、访问日志与阅读行为（时长 / 滚动深度）分析

## 技术栈

| 层级 | 方案 |
| --- | --- |
| 应用框架 | Next.js 16 App Router + React 19 |
| 语言 | TypeScript |
| 样式 | Tailwind CSS v4 + CSS Variables + OKLCH 主题变量 |
| 数据 | Prisma 7 + PostgreSQL（`@prisma/adapter-pg` 驱动适配器） |
| 认证 | NextAuth.js v4 + Prisma Adapter（本地账号 + GitHub OAuth） |
| 内容渲染 | react-markdown + remark-gfm + rehype-highlight + rehype-highlight-code-lines |
| AI | OpenAI 兼容接口（默认 DashScope / Qwen 兼容），后台可视化模型管理 |
| 存储与图片 | 七牛云对象存储 + compressorjs 客户端压缩 |
| 动效 | motion/react + View Transitions |
| 表单与校验 | react-hook-form + Zod |
| UI 组件 | Radix UI / Base UI + lucide-react + sonner + cmdk + recharts |
| 测试 | Vitest + Testing Library + Playwright |
| 部署 | Docker + Docker Compose + Nginx + GitHub Actions |

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

Windows PowerShell：

```powershell
Copy-Item .env.example .env
```

至少需要配置：

```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/my_next_app?schema=public"
AUTH_SECRET="replace-with-a-long-random-secret"
NEXTAUTH_SECRET="replace-with-a-long-random-secret"
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
```

### 3. 初始化数据库

```bash
pnpm prisma generate
pnpm prisma migrate dev
```

### 4. 启动开发服务器

```bash
pnpm dev
```

默认访问 `http://localhost:3000`。

## 常用命令

```bash
pnpm dev            # 启动本地开发（默认 http://localhost:3000）
pnpm build          # 生产构建
pnpm start          # 启动生产服务
pnpm lint           # ESLint 检查
pnpm test           # Vitest 单元 / 组件测试
pnpm test:e2e       # Playwright 端到端测试
pnpm ai-news:check  # 检查 AI 新闻流水线就绪状态
```

## 环境变量

完整模板见 [.env.example](./.env.example)。常用变量如下：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | 是 | PostgreSQL 连接串 |
| `AUTH_SECRET` | 是 | 应用认证密钥 |
| `NEXTAUTH_SECRET` | 是 | NextAuth 会话密钥 |
| `NEXTAUTH_URL` | 是 | 登录回调基准地址 |
| `NEXT_PUBLIC_SITE_URL` | 是 | 前台公开站点地址 |
| `NEXT_PUBLIC_CONTACT_EMAIL` | 否 | 联系页默认邮箱 |
| `GOOGLE_SITE_VERIFICATION` / `BING_SITE_VERIFICATION` | 否 | 搜索引擎站点验证 |
| `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` | 否 | GitHub OAuth 凭据 |
| `QINIU_ACCESS_KEY` / `QINIU_SECRET_KEY` / `QINIU_BUCKET` / `QINIU_DOMAIN` / `QINIU_UPLOAD_URL` | 否 | 七牛云图片上传 |
| `AI_OPENAI_COMPAT_API_KEY` / `AI_OPENAI_COMPAT_BASE_URL` / `AI_OPENAI_COMPAT_MODEL` | 否 | OpenAI 兼容 AI 模型（设置后优先） |
| `AI_POST_SUMMARY_TIMEOUT_MS` / `AI_POST_SUMMARY_MAX_INPUT_CHARS` | 否 | AI 摘要超时与输入字数上限 |
| `DASHSCOPE_API_KEY` / `DASHSCOPE_BASE_URL` / `DASHSCOPE_MODEL` | 否 | DashScope 兼容兜底密钥 |

## 项目结构

```text
.
├─ src/app
│  ├─ (public)         # 前台：首页、文章、分类、标签、系列、搜索、归档、书签、关于、联系
│  ├─ (auth)           # 登录、注册、认证回调
│  ├─ admin            # 后台：文章/分类/标签/系列/评论/封面/AI 模型/AI 任务/AI 新闻/日志/通知/设置
│  ├─ api              # Route Handlers（含 /api/ai/* Agent 接入与 /api/cron/* 定时任务）
│  ├─ profile          # 个人资料
│  └─ write            # 创作入口
├─ src/components       # admin / blog / layout / motion / posts / search / ui 等组件
├─ src/lib             # 认证、Prisma、SEO、AI（摘要/新闻/封面/任务）、限流、日志、订阅等能力
├─ prisma              # 数据模型与迁移
├─ scripts             # 数据初始化与运维脚本（seed、AI Token、就绪检查等）
├─ docs                # 设计、实施、部署与规划文档
├─ deploy              # Nginx 等部署配置
└─ .github/workflows   # CI / Deploy 工作流
```

## 数据模型

核心模型按四组划分：

- **账户与权限**：`User` / `Account` / `Session` / `VerificationToken`（角色 `USER` / `ADMIN`）
- **内容**：`Post` / `Category` / `Tag` / `Series` / `Comment` / `Like` / `Bookmark`
- **AI**：`AiModel` / `AiTask` / `AiTaskItem` / `AiApiClient` / `AiDraftBinding` / `AiNewsRun` / `AiNewsSource` / `AiNewsCandidate` / `CoverAsset`
- **运营与可观测**：`Notification` / `NotificationRecipient` / `VisitLog` / `ReadingEvent` / `ApiOperationLog` / `SystemSetting` / `NewsletterSubscriber`

文章、分类、标签、系列、评论、封面均采用软删除（`deletedAt`）；文章支持精选、阅读时长、定时发布、系列排序、SEO 字段、AI 摘要状态与封面资产关联。

## 部署

项目内置生产部署入口：

- Dockerfile: [Dockerfile](./Dockerfile)
- Compose: [docker-compose.prod.yml](./docker-compose.prod.yml)
- Nginx: [deploy/nginx.my-next-app.conf](./deploy/nginx.my-next-app.conf)
- 手动部署流程: [docs/deployment/github-actions-manual-deploy.md](./docs/deployment/github-actions-manual-deploy.md)

生产流程大致为：

```bash
pnpm build
docker compose -f docker-compose.prod.yml up -d --build
pnpm prisma migrate deploy
```

实际线上部署建议以部署文档和 GitHub Actions 工作流为准。

## 测试与质量

```bash
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

当前测试覆盖前台阅读、文章详情、搜索、RSS、SEO metadata、后台管理、评论、点赞、收藏、AI 任务与文章信息生成、AI 新闻去重 / 打分、部署脚本和关键组件契约。

## 路线图

- [ ] 补充 README 截图与在线演示录屏
- [ ] 扩展专题订阅 Feed 与 JSON Feed
- [ ] 增强 Lighthouse / 可访问性自动化报告
- [ ] 完善多语言内容与国际化路由
- [ ] 扩展更多 AI 写作与编辑辅助流程

## 文档

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [PROJECT_DOCS.md](./PROJECT_DOCS.md)
- [TEST_REPORT.md](./TEST_REPORT.md)
- [服务器执行清单](./docs/deployment/server-execution-checklist.md)
- [HTTPS / HTTP2 部署记录](./docs/deployment/https-http2-roydust-top.md)

## License

当前仓库未声明开源许可证。公开分发或商用复用前，请先补充 `LICENSE`。
