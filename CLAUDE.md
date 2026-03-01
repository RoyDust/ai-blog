# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个使用 Next.js 16 构建的现代化博客系统，支持用户注册登录、文章管理、评论、点赞收藏、分类标签和暗黑模式等功能。

## 常用命令

```bash
# 安装依赖
pnpm install

# 启动开发服务器 (默认端口 3001)
pnpm dev

# 构建生产版本
pnpm build

# 启动生产服务器
pnpm start

# 运行 ESLint 检查
pnpm lint
```

## 技术栈

- **框架**: Next.js 16 (App Router)
- **语言**: TypeScript
- **数据库**: PostgreSQL + Prisma ORM
- **认证**: NextAuth.js (支持本地登录 + GitHub OAuth)
- **样式**: Tailwind CSS v4
- **包管理器**: pnpm

## 代码架构

### 目录结构

```
src/
├── app/                    # Next.js App Router 页面
│   ├── api/               # API 路由
│   │   ├── auth/          # 认证相关 API
│   │   ├── admin/         # 管理后台 API
│   │   ├── posts/         # 文章 API
│   │   ├── comments/      # 评论 API
│   │   ├── categories/    # 分类 API
│   │   └── tags/          # 标签 API
│   ├── (auth)/            # 认证页面组 (login, register)
│   ├── admin/             # 管理后台页面
│   ├── posts/             # 文章页面
│   ├── categories/        # 分类页面
│   ├── tags/              # 标签页面
│   └── ...
├── components/            # React 组件
│   ├── ui/               # 基础 UI 组件
│   ├── layout/           # 布局组件 (Header, Footer, Sidebar)
│   ├── posts/            # 文章相关组件
│   └── blog/             # 博客功能组件
├── lib/                  # 工具库
│   ├── auth.ts           # NextAuth 配置
│   └── prisma.ts         # Prisma 客户端
└── types/                # TypeScript 类型定义
```

### 路径别名

使用 `@/*` 代替 `./src/*`，例如：
- `@/lib/prisma` → `src/lib/prisma.ts`
- `@/components/Header` → `src/components/layout/Header.tsx`

### 数据模型 (Prisma)

主要模型：
- **User**: 用户 (角色: USER / ADMIN)
- **Post**: 文章 (slug 唯一, 支持草稿/发布状态)
- **Category**: 分类
- **Tag**: 标签 (可选 color 字段)
- **Comment**: 评论 (支持嵌套回复)
- **Like**: 点赞 (用户-文章唯一)
- **Bookmark**: 收藏 (用户-文章唯一)

### 认证配置

- 认证配置位于 `src/lib/auth.ts`
- 使用 JWT 会话策略 (30天有效期)
- 支持本地账号 (bcrypt 加密) 和 GitHub OAuth
- 登录页面: `/login`
- 注册页面: `/register`

## 环境变量

需要配置以下环境变量 (详见 `.env`):
- `DATABASE_URL`: PostgreSQL 连接字符串
- `AUTH_SECRET`: NextAuth 密钥
- `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`: GitHub OAuth (可选)

## 数据库

```bash
# 初始化 Prisma 并推送 schema 到数据库
pnpm prisma db push

# 生成 Prisma Client
pnpm prisma generate
```
