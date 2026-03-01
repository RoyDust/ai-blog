# 博客系统架构设计文档

## 项目概述

- **项目名称**: my-next-app (博客系统)
- **技术栈**: Next.js 16 + React 19 + TypeScript + Tailwind CSS + pnpm
- **项目路径**: F:\Code\NewProject\my-next-app

---

## 1. 数据库设计

### 1.1 技术选型

推荐使用 **Prisma ORM** + **PostgreSQL** (或 SQLite 用于开发环境)

### 1.2 数据表结构

#### 1.2.1 用户表 (User)

```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  password      String?   // 仅本地登录使用
  role          Role      @default(USER)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // 关联
  posts         Post[]
  comments      Comment[]
  likes         Like[]
  bookmarks     Bookmark[]

  @@map("users")
}

enum Role {
  USER
  ADMIN
}
```

#### 1.2.2 文章表 (Post)

```prisma
model Post {
  id          String    @id @default(cuid())
  title       String
  slug        String    @unique
  content     String    @db.Text
  excerpt     String?
  coverImage  String?
  published   Boolean   @default(false)
  viewCount   Int       @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  publishedAt DateTime?

  // 关联
  authorId    String
  author      User      @relation(fields: [authorId], references: [id], onDelete: Cascade)
  categoryId String?
  category    Category? @relation(fields: [categoryId], references: [id])
  tags        Tag[]
  comments    Comment[]
  likes       Like[]
  bookmarks   Bookmark[]

  @@index([authorId])
  @@index([categoryId])
  @@index([published, createdAt])
  @@map("posts")
}
```

#### 1.2.3 分类表 (Category)

```prisma
model Category {
  id          String    @id @default(cuid())
  name        String    @unique
  slug        String    @unique
  description String?
  createdAt   DateTime  @default(now())

  // 关联
  posts       Post[]

  @@map("categories")
}
```

#### 1.2.4 标签表 (Tag)

```prisma
model Tag {
  id        String   @id @default(cuid())
  name      String   @unique
  slug      String   @unique
  color     String?  // 标签颜色，用于前端展示
  createdAt DateTime @default(now())

  // 关联
  posts     Post[]

  @@map("tags")
}
```

#### 1.2.5 评论表 (Comment)

```prisma
model Comment {
  id        String    @id @default(cuid())
  content   String    @db.Text
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  // 关联
  postId    String
  post      Post      @relation(fields: [postId], references: [id], onDelete: Cascade)
  authorId  String
  author    User      @relation(fields: [authorId], references: [id], onDelete: Cascade)
  parentId  String?
  parent    Comment?  @relation("CommentReplies", fields: [parentId], references: [id])
  replies   Comment[] @relation("CommentReplies")

  @@index([postId])
  @@index([authorId])
  @@map("comments")
}
```

#### 1.2.6 点赞表 (Like)

```prisma
model Like {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())

  // 关联
  postId    String
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([postId, userId]) // 同一用户只能点赞一次
  @@index([postId])
  @@map("likes")
}
```

#### 1.2.7 收藏表 (Bookmark)

```prisma
model Bookmark {
  id        String   @id @default(cuid())
  createdAt DateTime @default(now())

  // 关联
  postId    String
  post      Post     @relation(fields: [postId], references: [id], onDelete: Cascade)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([postId, userId])
  @@index([userId])
  @@map("bookmarks")
}
```

### 1.3 ER 关系图

```
User 1----* Post (作者)
Post *----* Category (分类)
Post *----* Tag (标签)
Post 1----* Comment (评论)
Comment *----* Comment (回复/嵌套)
Post *----* Like (点赞)
Post *----* Bookmark (收藏)
User 1----* Comment (评论作者)
User 1----* Like (点赞用户)
User 1----* Bookmark (收藏用户)
```

---

## 2. API 接口设计

### 2.1 技术选型

- 使用 Next.js App Router + Route Handlers
- API 路径前缀: `/api`

### 2.2 接口列表

#### 2.2.1 认证接口 (Auth)

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| POST | `/api/auth/register` | 用户注册 | 公开 |
| POST | `/api/auth/login` | 用户登录 | 公开 |
| POST | `/api/auth/logout` | 用户登出 | 已登录 |
| GET | `/api/auth/session` | 获取当前会话 | 已登录 |

#### 2.2.2 用户接口 (Users)

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | `/api/users/me` | 获取当前用户信息 | 已登录 |
| PATCH | `/api/users/me` | 更新当前用户信息 | 已登录 |
| GET | `/api/users/[id]` | 获取指定用户公开信息 | 公开 |

#### 2.2.3 文章接口 (Posts)

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | `/api/posts` | 获取文章列表 (分页) | 公开 |
| GET | `/api/posts/[slug]` | 获取文章详情 | 公开 |
| POST | `/api/posts` | 创建文章 | 已登录 |
| PATCH | `/api/posts/[id]` | 更新文章 | 作者/管理员 |
| DELETE | `/api/posts/[id]` | 删除文章 | 作者/管理员 |

**查询参数 (GET /api/posts)**:
- `page`: 页码 (默认: 1)
- `limit`: 每页数量 (默认: 10)
- `category`: 分类 slug
- `tag`: 标签 slug
- `author`: 作者 ID
- `search`: 搜索关键词
- `published`: 是否发布 (默认: true)

#### 2.2.4 分类接口 (Categories)

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | `/api/categories` | 获取所有分类 | 公开 |
| GET | `/api/categories/[slug]` | 获取分类详情 | 公开 |
| POST | `/api/categories` | 创建分类 | 管理员 |
| PATCH | `/api/categories/[id]` | 更新分类 | 管理员 |
| DELETE | `/api/categories/[id]` | 删除分类 | 管理员 |

#### 2.2.5 标签接口 (Tags)

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | `/api/tags` | 获取所有标签 | 公开 |
| GET | `/api/tags/[slug]` | 获取标签详情 | 公开 |
| POST | `/api/tags` | 创建标签 | 管理员 |
| PATCH | `/api/tags/[id]` | 更新标签 | 管理员 |
| DELETE | `/api/tags/[id]` | 删除标签 | 管理员 |

#### 2.2.6 评论接口 (Comments)

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| GET | `/api/posts/[postId]/comments` | 获取文章评论 | 公开 |
| POST | `/api/posts/[postId]/comments` | 添加评论 | 已登录 |
| PATCH | `/api/comments/[id]` | 更新评论 | 作者 |
| DELETE | `/api/comments/[id]` | 删除评论 | 作者/管理员 |

#### 2.2.7 点赞接口 (Likes)

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| POST | `/api/posts/[postId]/like` | 点赞/取消点赞 | 已登录 |
| GET | `/api/posts/[postId]/like/status` | 获取点赞状态 | 已登录 |

#### 2.2.8 收藏接口 (Bookmarks)

| 方法 | 路径 | 描述 | 权限 |
|------|------|------|------|
| POST | `/api/posts/[postId]/bookmark` | 收藏/取消收藏 | 已登录 |
| GET | `/api/bookmarks` | 获取用户收藏列表 | 已登录 |
| GET | `/api/posts/[postId]/bookmark/status` | 获取收藏状态 | 已登录 |

### 2.3 API 响应格式

```typescript
// 成功响应
interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 错误响应
interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: Record<string, string[]>;
  };
}
```

---

## 3. 前端页面结构

### 3.1 目录结构 (App Router)

```
src/app/
├── page.tsx                    # 首页 (文章列表)
├── layout.tsx                  # 根布局
├── globals.css                 # 全局样式
│
├── (auth)/
│   ├── login/
│   │   └── page.tsx            # 登录页
│   ├── register/
│   │   └── page.tsx            # 注册页
│   └── layout.tsx              # 认证布局
│
├── (blog)/
│   ├── posts/
│   │   ├── page.tsx            # 文章列表页
│   │   └── [slug]/
│   │       └── page.tsx         # 文章详情页
│   │
│   ├── categories/
│   │   ├── page.tsx            # 分类列表页
│   │   └── [slug]/
│   │       └── page.tsx        # 分类文章列表页
│   │
│   ├── tags/
│   │   ├── page.tsx            # 标签云页
│   │   └── [slug]/
│   │       └── page.tsx        # 标签文章列表页
│   │
│   └── author/
│       └── [id]/
│           └── page.tsx        # 作者文章列表页
│
├── (user)/
│   ├── profile/
│   │   └── page.tsx            # 个人资料页
│   ├── dashboard/
│   │   └── page.tsx            # 用户仪表盘
│   ├── posts/
│   │   ├── manage/
│   │   │   └── page.tsx        # 文章管理页
│   │   ├── create/
│   │   │   └── page.tsx        # 创建文章页
│   │   └── [id]/
│   │       └── edit/
│   │           └── page.tsx   # 编辑文章页
│   └── bookmarks/
│       └── page.tsx            # 收藏列表页
│
├── (admin)/
│   └── admin/
│       ├── page.tsx            # 管理后台首页
│       ├── users/
│       │   └── page.tsx        # 用户管理
│       ├── categories/
│       │   └── page.tsx       # 分类管理
│       ├── tags/
│       │   └── page.tsx        # 标签管理
│       └── comments/
│           └── page.tsx        # 评论管理
│
└── api/                        # API 路由 (后端)
    ├── auth/
    ├── posts/
    ├── categories/
    ├── tags/
    ├── comments/
    ├── users/
    └── bookmarks/
```

### 3.2 页面组件设计

#### 3.2.1 首页 (/)
- 顶部导航栏 (Logo, 导航链接, 搜索, 登录/用户菜单)
- 轮播图 (推荐文章)
- 文章列表 (分页)
- 侧边栏 (热门标签, 热门文章, 分类列表)
- 页脚

#### 3.2.2 文章详情页 (/posts/[slug])
- 文章头部 (标题, 作者, 日期, 分类, 标签, 阅读量)
- 文章内容 (Markdown 渲染)
- 点赞/收藏按钮
- 评论区
- 相关文章推荐

#### 3.2.3 用户仪表盘 (/dashboard)
- 统计概览 (文章数, 评论数, 获赞数)
- 最近文章
- 快捷操作

### 3.3 组件库设计

```
src/components/
├── ui/                         # 基础 UI 组件
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Modal.tsx
│   ├── Dropdown.tsx
│   ├── Card.tsx
│   ├── Avatar.tsx
│   ├── Badge.tsx
│   └── ...
│
├── layout/                     # 布局组件
│   ├── Header.tsx
│   ├── Footer.tsx
│   ├── Sidebar.tsx
│   ├── Navbar.tsx
│   └── Container.tsx
│
├── blog/                       # 博客相关组件
│   ├── PostCard.tsx
│   ├── PostList.tsx
│   ├── PostDetail.tsx
│   ├── CategoryList.tsx
│   ├── TagCloud.tsx
│   ├── AuthorCard.tsx
│   └── ...
│
├── comment/                    # 评论组件
│   ├── CommentList.tsx
│   ├── CommentItem.tsx
│   ├── CommentForm.tsx
│   └── CommentReply.tsx
│
├── auth/                       # 认证组件
│   ├── LoginForm.tsx
│   ├── RegisterForm.tsx
│   └── AuthProvider.tsx
│
└── admin/                      # 管理后台组件
    ├── DataTable.tsx
    ├── EditModal.tsx
    └── StatsCard.tsx
```

---

## 4. 认证方案

### 4.1 技术选型: NextAuth.js (v5)

### 4.2 认证方式

1. ** Credentials** (用户名/密码本地登录)
2. ** GitHub** (第三方登录)
3. ** Google** (第三方登录)

### 4.3 实现方案

#### 4.3.1 安装依赖

```bash
pnpm add next-auth @auth/prisma-adapter bcryptjs
pnpm add -D @types/bcryptjs
```

#### 4.3.2 配置文件结构

```
src/
├── auth.ts                     # NextAuth 配置
├── app/api/auth/[...nextauth]/
│   └── route.ts               # NextAuth 路由处理器
├── lib/
│   ├── db.ts                  # Prisma 客户端
│   └── auth.ts                # 认证工具函数
```

#### 4.3.3 NextAuth 配置 (auth.ts)

```typescript
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import GitHub from "next-auth/providers/github"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "@/lib/db"
import bcrypt from "bcryptjs"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    GitHub,
    Google,
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // 验证逻辑
      }
    })
  ],
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/login",
    error: "/login"
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = user.role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.role = token.role as string
      }
      return session
    }
  }
})
```

### 4.4 权限控制

| 角色 | 权限 |
|------|------|
| 游客 | 浏览文章、分类、标签、评论 |
| 用户 | 发布文章、评论、点赞、收藏、编辑个人资料 |
| 管理员 | 所有权限 + 用户管理、分类/标签管理、评论管理 |

---

## 5. 实现任务列表

### 阶段一: 基础搭建 (Task 1-8)

| 任务ID | 任务名称 | 描述 | 预估时间 |
|--------|----------|------|----------|
| 1 | 安装项目依赖 | 安装 Prisma、NextAuth、bcryptjs 等依赖 | 0.5h |
| 2 | 配置 Prisma | 创建 schema.prisma，配置数据库模型 | 1h |
| 3 | 创建数据库 | 初始化数据库，表结构 | 0.5h |
| 4 | 创建工具函数 | 创建 Prisma 客户端实例、认证工具 | 0.5h |
| 5 | 配置 NextAuth | 配置 NextAuth 认证方案 | 1h |
| 6 | 创建认证 API | 实现登录、注册、登出接口 | 1.5h |
| 7 | 创建认证页面 | 实现登录、注册页面 | 1h |
| 8 | 配置 Tailwind | 完善 Tailwind 配置，添加自定义主题 | 0.5h |

### 阶段二: 核心功能 (Task 9-18)

| 任务ID | 任务名称 | 描述 | 预估时间 |
|--------|----------|------|----------|
| 9 | 基础 UI 组件 | 创建 Button、Input、Card 等基础组件 | 1h |
| 10 | 布局组件 | 创建 Header、Footer、Sidebar | 1h |
| 11 | 文章 CRUD API | 实现文章的增删改查接口 | 2h |
| 12 | 文章列表页 | 实现首页文章列表，支持分页、筛选 | 1.5h |
| 13 | 文章详情页 | 实现文章详情页，支持 Markdown 渲染 | 1.5h |
| 14 | 分类管理 | 实现分类 CRUD API 和页面 | 1.5h |
| 15 | 标签管理 | 实现标签 CRUD API 和页面 | 1.5h |
| 16 | 评论功能 | 实现评论、回复功能 | 2h |
| 17 | 点赞功能 | 实现文章点赞/取消点赞 | 1h |
| 18 | 收藏功能 | 实现文章收藏/取消收藏 | 1h |

### 阶段三: 用户功能 (Task 19-24)

| 任务ID | 任务名称 | 描述 | 预估时间 |
|--------|----------|------|----------|
| 19 | 用户仪表盘 | 创建用户个人仪表盘 | 1h |
| 20 | 文章管理 | 创建文章管理页面 | 1.5h |
| 21 | 创建/编辑文章 | 创建文章编辑器，支持 Markdown | 2h |
| 22 | 个人资料页 | 创建个人资料编辑页面 | 1h |
| 23 | 收藏列表页 | 创建用户收藏列表页面 | 1h |
| 24 | 我的文章页 | 创建用户自己的文章列表页 | 1h |

### 阶段四: 管理后台 (Task 25-30)

| 任务ID | 任务名称 | 描述 | 预估时间 |
|--------|----------|------|----------|
| 25 | 管理后台布局 | 创建管理后台布局和导航 | 1h |
| 26 | 用户管理 | 实现用户列表、权限管理 | 1.5h |
| 27 | 分类管理 | 实现分类管理界面 | 1h |
| 28 | 标签管理 | 实现标签管理界面 | 1h |
| 29 | 评论管理 | 实现评论管理界面 | 1h |
| 30 | 数据统计 | 实现基本数据统计面板 | 1h |

### 阶段五: 优化与完善 (Task 31-36)

| 任务ID | 任务名称 | 描述 | 预估时间 |
|--------|----------|------|----------|
| 31 | 搜索功能 | 实现文章搜索功能 | 1h |
| 32 | SEO 优化 | 添加 Meta 标签、Open Graph | 1h |
| 33 | 性能优化 | 添加 React Query 或 SWR 缓存 | 1.5h |
| 34 | 错误处理 | 完善错误边界和提示 | 0.5h |
| 35 | 响应式适配 | 完善移动端适配 | 1h |
| 36 | 代码规范 | 配置 ESLint、Prettier | 0.5h |

---

## 6. 技术栈总结

| 类别 | 技术选型 |
|------|----------|
| 框架 | Next.js 16 (App Router) |
| 语言 | TypeScript |
| UI | Tailwind CSS |
| 数据库 | PostgreSQL / SQLite |
| ORM | Prisma |
| 认证 | NextAuth.js v5 |
| 表单 | React Hook Form + Zod |
| Markdown | react-markdown / @next/mdx |
| 图标 | Lucide React |
| 包管理 | pnpm |

---

## 7. 开发规范建议

1. **代码风格**: 使用 ESLint + Prettier
2. **组件命名**: 使用 PascalCase (如 PostCard)
3. **文件命名**: 使用 kebab-case (如 post-card.tsx)
4. **API 响应**: 遵循统一响应格式
5. **错误处理**: 使用 Error Boundary
6. **类型安全**: 尽量避免 any，使用 TypeScript

---

## 8. 下一步行动

1. 确认数据库选择 (PostgreSQL / SQLite)
2. 开始执行 Task 1: 安装项目依赖
3. 创建 Prisma schema 并初始化数据库

---

*文档版本: v1.0*
*创建日期: 2026-03-01*
