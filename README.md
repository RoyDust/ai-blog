# RoyDust AI Blog

<div align="center">

[简体中文](./README.md) | [English](./README.en.md)

一套面向独立写作者和技术团队的全栈博客系统。它不是只有展示页的主题模板，而是把阅读体验、内容生产、后台运营、AI 辅助写作和生产部署放在同一个 Next.js 应用里。

[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-111111?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.3-149ECA?logo=react)](https://react.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-7.4.2-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-336791?logo=postgresql)](https://www.postgresql.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38BDF8?logo=tailwindcss)](https://tailwindcss.com/)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-F69220?logo=pnpm)](https://pnpm.io/)

[在线预览](http://47.98.167.32) · [架构说明](./ARCHITECTURE.md) · [部署指南](./docs/deployment/github-actions-manual-deploy.md) · [项目文档](./PROJECT_DOCS.md)

</div>

## 预览

截图位先预留，后续把图片放进 `docs/assets/readme/` 后替换这里即可。

| 阅读首页 | 文章详情 | 管理后台 |
| --- | --- | --- |
| `docs/assets/readme/public-home.png` | `docs/assets/readme/post-detail.png` | `docs/assets/readme/admin-dashboard.png` |

## 为什么做它

很多博客项目只解决“把 Markdown 渲染出来”，真正上线后还会遇到搜索、订阅、SEO、评论、后台、图片上传、内容复用、部署和可观测的问题。RoyDust AI Blog 的目标是把这些生产环节一次性接上，让博客既像独立技术博客一样有阅读质感，也像一个小型内容产品一样可以长期运营。

## 核心能力

- **现代阅读体验**：首页、文章列表、文章详情、归档、分类、标签、系列、搜索、书签页完整可用。
- **内容生产闭环**：Markdown 编辑、封面管理、分类标签、精选文章、定时发布、系列文章和 AI 摘要生成。
- **读者互动**：匿名点赞、评论、嵌套回复、本地收藏、Newsletter 订阅与退订。
- **分发基础设施**：RSS、`sitemap.xml`、`robots.txt`、`manifest`、Open Graph 图片和 SEO metadata。
- **后台运营**：文章、分类、标签、系列、评论、封面、AI 模型、AI 任务、系统设置和操作日志管理。
- **工程化交付**：Prisma 迁移、Vitest、Playwright、ESLint、Docker、Nginx、GitHub Actions CI/CD。

## 功能一览

### 面向读者

- 沉浸式首页与精选文章区
- 文章详情页、阅读进度、目录、代码高亮和代码行号
- 分类、标签、系列、归档与站内搜索
- 点赞、评论、本地收藏、分享和返回顶部
- 移动端目录抽屉、暗色模式、减少动态效果适配

### 面向作者

- Markdown 写作与文章编辑工作台
- 文章摘要、SEO 字段、封面图、分类、标签、系列归档
- 七牛云图片上传与客户端图片压缩
- AI 摘要、AI 审稿、AI 新闻候选与日报生成流程
- 草稿、发布、定时发布、软删除与公开路径重验证

### 面向管理员

- 文章、分类、标签、系列、评论的后台管理
- 评论审核状态：`APPROVED` / `PENDING` / `REJECTED` / `SPAM`
- 封面图库、AI 模型管理、批量 AI 任务、通知中心
- 站点基础设置、Newsletter 配置、联系页配置
- API 操作日志与后台搜索

## 技术栈

| 层级 | 方案 |
| --- | --- |
| 应用框架 | Next.js 16 App Router + React 19 |
| 语言 | TypeScript |
| 样式 | Tailwind CSS v4 + CSS Variables + OKLCH 主题变量 |
| 数据 | Prisma 7 + PostgreSQL |
| 认证 | NextAuth.js v4 + Prisma Adapter |
| 内容 | react-markdown + remark-gfm + rehype-highlight + rehype-highlight-code-lines |
| 动效 | motion/react + View Transitions |
| 表单与校验 | react-hook-form + Zod |
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

Windows PowerShell:

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
pnpm dev        # 启动本地开发
pnpm build      # 生产构建
pnpm start      # 启动生产服务
pnpm lint       # ESLint 检查
pnpm test       # Vitest 单元/组件测试
pnpm test:e2e   # Playwright 端到端测试
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
| `GOOGLE_SITE_VERIFICATION` | 否 | Google Search Console 验证 |
| `BING_SITE_VERIFICATION` | 否 | Bing Webmaster Tools 验证 |
| `AUTH_GITHUB_ID` | 否 | GitHub OAuth Client ID |
| `AUTH_GITHUB_SECRET` | 否 | GitHub OAuth Client Secret |
| `QINIU_ACCESS_KEY` | 否 | 七牛云 Access Key |
| `QINIU_SECRET_KEY` | 否 | 七牛云 Secret Key |
| `QINIU_BUCKET` | 否 | 七牛云 Bucket |
| `QINIU_DOMAIN` | 否 | 七牛资源访问域名 |
| `AI_OPENAI_COMPAT_API_KEY` | 否 | OpenAI 兼容模型 API Key |
| `AI_OPENAI_COMPAT_BASE_URL` | 否 | OpenAI 兼容模型 Base URL |
| `AI_OPENAI_COMPAT_MODEL` | 否 | 默认 AI 模型 |
| `DASHSCOPE_API_KEY` | 否 | DashScope 兼容兜底密钥 |

## 项目结构

```text
.
├─ src/app
│  ├─ (public)         # 前台页面：首页、文章、分类、标签、系列、搜索、归档、书签
│  ├─ (auth)           # 登录、注册、认证回调
│  ├─ admin            # 管理后台
│  ├─ api              # Route Handlers
│  ├─ profile          # 个人资料入口
│  └─ write            # 创作入口
├─ src/components
│  ├─ admin            # 后台组件
│  ├─ blog             # 阅读体验组件
│  ├─ layout           # 公共布局
│  ├─ motion           # 动效原语
│  ├─ posts            # 编辑器与发文工作流
│  ├─ search           # 搜索组件
│  └─ ui               # 基础 UI 组件
├─ src/lib             # 认证、Prisma、SEO、缓存、校验、AI、订阅、限流等能力
├─ prisma              # 数据模型与迁移
├─ docs                # 设计、实施、部署和规划文档
├─ deploy              # Nginx 等部署配置
└─ .github/workflows   # CI / Deploy 工作流
```

## 数据模型

核心模型覆盖：

- `User` / `Account` / `Session` / `VerificationToken`
- `Post` / `Category` / `Tag` / `Series`
- `Comment` / `Like` / `Bookmark`
- `NewsletterSubscriber` / `Notification` / `VisitLog`
- `AiModel` / `AiTask` / `AiNewsRun` / `CoverAsset`

文章、分类、标签、系列和评论均采用软删除思路；文章支持精选、阅读时长、定时发布、系列排序、SEO 字段和封面图。

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

当前测试覆盖前台阅读、文章详情、搜索、RSS、SEO metadata、后台管理、评论、点赞、收藏、AI 任务、部署脚本和关键组件契约。

## 路线图

- [ ] 补充 README 截图和在线演示录屏
- [ ] 增强专题订阅 Feed 与 JSON Feed
- [ ] 扩展 Lighthouse / 可访问性自动化报告
- [ ] 完善多语言内容与国际化路由
- [ ] 增加更多 AI 写作与编辑辅助流程

## 文档

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [PROJECT_DOCS.md](./PROJECT_DOCS.md)
- [TEST_REPORT.md](./TEST_REPORT.md)
- [服务器执行清单](./docs/deployment/server-execution-checklist.md)
- [HTTPS / HTTP2 部署记录](./docs/deployment/https-http2-roydust-top.md)

## License

当前仓库未声明开源许可证。公开分发或商用复用前，请先补充 `LICENSE`。
