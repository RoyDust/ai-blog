# Blog System

<div align="center">

[简体中文](./README.md) | [English](./README.en.md)

一个基于 `Next.js 16`、`React 19`、`Prisma 7` 和 `PostgreSQL` 的现代博客系统，覆盖公开阅读、内容创作、后台管理与生产部署链路。

[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-111111?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.3-149ECA?logo=react)](https://react.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-7.4.2-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-336791?logo=postgresql)](https://www.postgresql.org/)
[![pnpm](https://img.shields.io/badge/pnpm-workspace-F69220?logo=pnpm)](https://pnpm.io/)

[在线地址](http://47.98.167.32) · [架构文档](./ARCHITECTURE.md) · [部署指南](./docs/deployment/github-actions-manual-deploy.md)

</div>

## 项目简介

这个项目不是单纯的文章列表模板，而是一套从前台阅读体验到后台内容管理都已经串起来的博客应用。仓库中已经落地了公开页面、文章编辑与发布、分类和标签体系、互动能力、站点元信息生成，以及基于 GitHub Actions + Docker Compose 的部署流程，适合作为个人博客、内容站点或中小型知识库项目的基础骨架。

## 核心亮点

- `App Router` 架构完整，公开站点、认证页面、作者写作区、管理后台和 API 路由分层清晰。
- 文章体系完整，支持草稿/发布、分类、标签、阅读时长、封面图、软删除与后台维护。
- 阅读体验成型，包含首页、文章列表、文章详情、归档、标签页、分类页、站内搜索、RSS、站点地图和 robots。
- 互动能力已接入，支持匿名评论、匿名点赞、本地收藏书架，以及后台评论审核状态管理。
- 编辑器支持 Markdown 写作、七牛云图片上传、可选 DashScope 摘要生成，适合持续内容创作。
- 工程化基础到位，包含 Vitest、Playwright、CI 工作流、手动部署工作流和生产 Docker 配置。

## 功能全景

### 面向读者

- 首页与最新文章流
- 文章详情页与 Markdown 渲染
- 分类、标签、归档、站内搜索
- 阅读时长、点赞、评论、收藏
- RSS 订阅、`sitemap.xml`、`robots.txt`、`manifest`

### 面向作者与管理员

- 登录 / 注册 / 会话管理
- 写作页与后台文章编辑
- 分类、标签、评论管理后台
- 评论状态流转：`APPROVED` / `PENDING` / `REJECTED` / `SPAM`
- 文章、分类、标签、评论的软删除处理

### 面向工程与部署

- Prisma Schema 与 PostgreSQL 数据模型
- GitHub Actions CI + 手动 CD
- Docker Compose 生产部署
- 可选七牛云上传能力
- 可选 DashScope 文章摘要生成

## 技术栈

| 类别 | 方案 |
| --- | --- |
| 前端框架 | Next.js 16 + React 19 + TypeScript |
| 样式方案 | Tailwind CSS 4 |
| 数据层 | Prisma 7 + PostgreSQL |
| 认证 | NextAuth.js |
| 内容能力 | react-markdown + remark-gfm + rehype-highlight |
| 动效与交互 | Framer Motion + Sonner |
| 测试 | Vitest + Testing Library + Playwright |
| 部署 | GitHub Actions + Docker Compose + Nginx |

## 项目结构

```text
.
├─ src/app
│  ├─ (public)         # 前台阅读页：首页、文章、分类、标签、搜索、归档、书签等
│  ├─ (auth)           # 登录 / 注册
│  ├─ admin            # 后台管理
│  ├─ api              # Route Handlers
│  ├─ profile          # 个人资料
│  └─ write            # 创作入口
├─ src/components
│  ├─ admin            # 后台界面组件
│  ├─ blog             # 博客阅读体验组件
│  ├─ layout           # 站点布局
│  ├─ posts            # 编辑器与发文工作流
│  ├─ search           # 搜索体验
│  └─ ui               # 基础 UI 组件
├─ src/lib             # 认证、Prisma、SEO、缓存、校验、限流等基础能力
├─ prisma              # 数据模型与迁移
├─ docs                # 设计、实现、部署与规划文档
├─ deploy              # Nginx 等部署辅助文件
└─ .github/workflows   # CI / Deploy 工作流
```

## 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，至少补齐数据库与认证相关配置。

```bash
cp .env.example .env
```

Windows PowerShell 可使用：

```powershell
Copy-Item .env.example .env
```

### 3. 初始化数据库

```bash
pnpm prisma generate
pnpm prisma migrate dev
```

### 4. 启动开发环境

```bash
pnpm dev
```

默认访问地址为 `http://localhost:3000`。

## 环境变量

项目完整示例见 `.env.example`，常用变量如下：

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | 是 | PostgreSQL 连接串 |
| `AUTH_SECRET` | 是 | 认证签名密钥 |
| `NEXTAUTH_SECRET` | 是 | NextAuth 密钥 |
| `NEXTAUTH_URL` | 是 | 认证回调地址 |
| `NEXT_PUBLIC_SITE_URL` | 是 | 站点公开访问地址 |
| `AUTH_GITHUB_ID` | 否 | GitHub OAuth Client ID |
| `AUTH_GITHUB_SECRET` | 否 | GitHub OAuth Client Secret |
| `QINIU_ACCESS_KEY` | 否 | 七牛云 Access Key |
| `QINIU_SECRET_KEY` | 否 | 七牛云 Secret Key |
| `QINIU_BUCKET` | 否 | 七牛云 Bucket |
| `QINIU_DOMAIN` | 否 | 七牛资源访问域名 |
| `QINIU_UPLOAD_URL` | 否 | 七牛上传地址 |
| `DASHSCOPE_API_KEY` | 否 | DashScope API Key |
| `DASHSCOPE_BASE_URL` | 否 | DashScope 兼容接口地址 |
| `DASHSCOPE_MODEL` | 否 | DashScope 模型名 |

## 常用命令

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm test
pnpm test:e2e
```

## 数据模型概览

Prisma 当前维护的核心模型包括：

- `User` / `Account` / `Session` / `VerificationToken`
- `Post` / `Category` / `Tag`
- `Comment` / `Like` / `Bookmark`

其中 `Post`、`Category`、`Tag`、`Comment` 已支持 `deletedAt` 软删除字段，`Comment` 支持嵌套回复与审核状态，`Post` 支持 `readingTimeMinutes` 阅读时长统计。

## 测试与质量保障

仓库已经配置单元测试、组件测试和端到端测试能力：

```bash
pnpm test
pnpm test:e2e
pnpm build
```

测试覆盖了前台阅读流程、后台管理、搜索、评论、点赞、图片兜底、Markdown 编辑器等关键模块。

## 部署说明

项目当前采用拆分式 CI/CD：

- CI：每次 push / pull request 自动运行
- CD：通过 GitHub Actions 手动触发
- 生产部署：服务端使用 `docker-compose.prod.yml` 重建应用并执行 Prisma 迁移

关键入口：

- CI 工作流：`.github/workflows/ci.yml`
- Deploy 工作流：`.github/workflows/deploy.yml`
- 生产编排：`docker-compose.prod.yml`
- Nginx 配置：`deploy/nginx.my-next-app.conf`
- 部署文档：`docs/deployment/github-actions-manual-deploy.md`

当前公开服务器地址：

```text
http://47.98.167.32
```

## 补充文档

- [ARCHITECTURE.md](./ARCHITECTURE.md)
- [PROJECT_DOCS.md](./PROJECT_DOCS.md)
- [部署指南](./docs/deployment/github-actions-manual-deploy.md)
- [服务器执行清单](./docs/deployment/server-execution-checklist.md)

## 适用场景

如果你正在寻找一个已经具备以下能力的博客基础项目，这个仓库会比较合适：

- 想要一个可继续迭代的个人博客或技术站点
- 需要前后台一体化，而不是只有展示页模板
- 希望保留自托管和可控部署能力
- 希望在 Markdown 创作流里接入图片上传与 AI 摘要能力
