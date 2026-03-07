# My Blog

一个使用 Next.js 16 构建的现代化博客系统。

## 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

访问 `http://localhost:3000`

## 功能特性

- 用户注册/登录
- 文章发布和管理
- 分类和标签
- 点赞和收藏
- 评论系统
- 搜索功能
- 暗色模式
- 管理后台

## 技术栈

- Next.js 16
- TypeScript
- Prisma + PostgreSQL
- NextAuth.js
- Tailwind CSS
- React 19

## 环境变量

详见 `PROJECT_DOCS.md`

## 管理员初始化

- 不要通过 HTTP 接口初始化管理员。
- 管理员角色应通过 Prisma seed、数据库迁移或受控的离线脚本完成。

## 文档

详细开发文档见 [PROJECT_DOCS.md](./PROJECT_DOCS.md)

## 验证命令

```bash
pnpm lint
pnpm build
pnpm test
pnpm test:e2e
```

## Frontend Style Notes

- 前台页面已迁移到 `src/app/(public)` 路由组，并由 `src/app/(public)/layout.tsx` 挂载 BlogT3 风格壳层。
- 新的前台样式基础位于 `src/styles/theme-variables.css`、`src/styles/components.css`、`src/styles/animations.css`。
- 主题色相通过 `localStorage` 的 `theme-hue` 持久化，并驱动全局 CSS 变量 `--hue`。
- 如果要在开发环境运行前台动态页面或 E2E，请先确保 PostgreSQL 可访问。
