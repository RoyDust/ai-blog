# My Blog

一个使用 `Next.js 16` 构建的现代化博客系统。

## 快速开始

```bash
pnpm install
pnpm dev
```

访问 `http://localhost:3000`

## 功能概览

- 用户注册与登录
- 文章发布与管理
- 分类与标签
- 点赞与收藏
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

参考 `.env.example`。

当前项目主要使用以下变量：

- `DATABASE_URL`：PostgreSQL 连接串
- `AUTH_SECRET`：认证签名密钥
- `NEXTAUTH_URL`：认证回调地址
- `NEXT_PUBLIC_SITE_URL`：站点公开地址
- `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`：GitHub 登录配置，可选
- `QINIU_ACCESS_KEY` / `QINIU_SECRET_KEY` / `QINIU_BUCKET` / `QINIU_DOMAIN` / `QINIU_UPLOAD_URL`：七牛上传配置，可选

## 管理员初始化

- 不要通过 HTTP 接口初始化管理员
- 管理员角色应通过 Prisma seed、数据库迁移或受控离线脚本完成

## 验证命令

```bash
pnpm build
pnpm test
```

## 前端说明

- 前台页面位于 `src/app/(public)`
- 文章列表 `/posts` 采用 ISR 静态外壳 + 客户端筛选
- 文章详情页 `/posts/[slug]` 采用 SSG + `generateStaticParams`
- 若本地工作树目录没有 `.env`，数据库连接会向上回溯查找仓库根目录的 `.env` / `.env.local`

## Deployment

- CI: `.github/workflows/ci.yml`
- Manual deploy: `.github/workflows/deploy.yml`
- Production compose: `docker-compose.prod.yml`
- Server deploy guide: `docs/deployment/github-actions-manual-deploy.md`
- Required environment variables: `.env.example`
- Public server address without domain: `http://47.98.167.32`
