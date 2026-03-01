# 博客项目开发文档

## 项目信息

- **项目路径**: `F:\Code\NewProject\my-next-app`
- **开发服务器**: http://localhost:3001
- **包管理器**: pnpm

## 技术栈

- Next.js 16 (App Router)
- TypeScript
- Prisma 7 + PostgreSQL
- NextAuth.js v4
- Tailwind CSS v4
- React 19

## 数据库

- **类型**: PostgreSQL
- **地址**: 47.98.167.32:5432
- **数据库名**: T3Blog

## 环境变量 (.env)

```env
# Database
DATABASE_URL="postgresql://root:XW147369258@47.98.167.32:5432/T3Blog"

# NextAuth
AUTH_SECRET="azd9jcSX011UgGtbE6SNZALCCxFy24m4ctmrRAn4dow="
NEXTAUTH_URL="http://localhost:3001"

# GitHub OAuth (可选)
AUTH_GITHUB_ID=""
AUTH_GITHUB_SECRET=""
```

## 常用命令

```bash
# 启动开发服务器
pnpm dev

# 构建项目
pnpm build

# TypeScript 检查
pnpm tsc --noEmit
```

## 项目结构

```
src/
├── app/                    # Next.js App Router 页面
│   ├── (auth)/            # 认证页面 (login, register)
│   ├── admin/             # 管理后台
│   │   ├── posts/         # 文章管理
│   │   ├── categories/    # 分类管理
│   │   ├── tags/          # 标签管理
│   │   └── comments/      # 评论管理
│   ├── api/               # API 路由
│   │   ├── auth/          # 认证相关 API
│   │   ├── admin/         # 管理后台 API
│   │   └── posts/         # 文章 API
│   ├── posts/             # 文章详情页
│   ├── categories/        # 分类列表和详情页
│   ├── tags/              # 标签列表和详情页
│   └── ...
├── components/            # React 组件
│   ├── blog/             # 博客相关组件
│   ├── ui/                # UI 基础组件
│   └── ...
└── lib/                  # 工具函数
    ├── auth.ts            # NextAuth 配置
    └── prisma.ts         # Prisma 客户端
```

## 关键问题和解决方案

### 1. 登出功能

**问题**: 点击登出按钮无法清除 session

**解决方案**:
- 添加了 `AuthProvider` 组件包裹整个应用 (`src/components/AuthProvider.tsx`)
- 在 `layout.tsx` 中引入 SessionProvider

```tsx
// src/app/layout.tsx
import { AuthProvider } from "@/components/AuthProvider"

// 在 body 中包裹
<AuthProvider>
  <ThemeProvider>
    {children}
  </ThemeProvider>
</AuthProvider>
```

### 2. 标签/分类详情页

**问题**: 点击标签/分类显示"不存在"

**原因**: Next.js 传递的 slug 参数是 URL 编码的 (如 `%E7%BE%A4%E5%B2%9A`)，但数据库中存储的是解码后的中文

**解决方案**: 在获取标签/分类时需要处理 URL 编码

```typescript
// src/app/tags/[slug]/page.tsx
async function getTag(slug: string) {
  const allTags = await prisma.tag.findMany({...})

  // 遍历匹配
  for (const tag of allTags) {
    if (tag.slug === slug) return tag
    if (tag.name === slug) return tag
    try {
      const decoded = decodeURIComponent(slug)
      if (tag.slug === decoded || tag.name === decoded) return tag
    } catch (e) {}
  }
  return null
}
```

### 3. 点赞/收藏 API

**问题**: 点赞按钮无法使用

**解决方案**:
- 创建了缺失的 API 路由: `src/app/api/posts/[slug]/like/route.ts`
- 修改 LikeButton 和 BookmarkButton 组件使用 `slug` 而不是 `postId`

### 4. 后台管理

**功能**:
- `/admin` - 管理后台首页
- `/admin/posts` - 文章管理 (增删改查)
- `/admin/categories` - 分类管理
- `/admin/tags` - 标签管理
- `/admin/comments` - 评论管理

**权限**: 需要 ADMIN 角色才能访问

### 5. 设置管理员

通过 API 设置用户为管理员:
```bash
curl -X POST http://localhost:3001/api/admin/set-admin \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

## 已创建的文件

### API 路由
- `src/app/api/admin/categories/route.ts` - 分类 CRUD
- `src/app/api/admin/tags/route.ts` - 标签 CRUD
- `src/app/api/admin/comments/route.ts` - 评论管理
- `src/app/api/admin/posts/route.ts` - 文章删除
- `src/app/api/admin/posts/publish/route.ts` - 发布状态切换
- `src/app/api/posts/[slug]/like/route.ts` - 点赞 API
- `src/app/api/posts/[slug]/bookmark/route.ts` - 收藏 API

### 页面
- `src/app/tags/[slug]/page.tsx` - 标签详情页
- `src/app/categories/[slug]/page.tsx` - 分类详情页

### 组件
- `src/components/AuthProvider.tsx` - NextAuth SessionProvider
- `src/components/UserNav.tsx` - 用户导航 (登录/登出)
- `src/components/LogoutButton.tsx` - 登出按钮

## 数据库模型

核心表:
- `users` - 用户 (id, email, name, password, role)
- `posts` - 文章 (title, slug, content, published)
- `categories` - 分类 (name, slug)
- `tags` - 标签 (name, slug, color)
- `comments` - 评论
- `likes` - 点赞
- `bookmarks` - 收藏

NextAuth 表:
- `accounts` - OAuth 账户
- `sessions` - 会话
- `verificationToken` - 邮箱验证

## 测试结果

- 首页: ✅
- 登录/注册: ✅
- 文章详情: ✅
- 点赞/收藏: ✅
- 标签/分类: ✅
- 后台管理: ✅
- 登出: ✅

---
最后更新: 2026-03-02
