# 项目重大问题分析报告

> 分析日期：2026-04-26 | 范围：全项目 | 分析模型：deepseek-v4-pro

---

## 一、致命问题 (CRITICAL)

### 1. 登录/登出完全无效 —— 认证流程已损坏

- **文件**：[src/app/api/auth/login/route.ts](src/app/api/auth/login/route.ts)
- **问题**：`POST` 校验密码后只返回用户数据（`{ success: true, data: {...} }`），**从未调用 `signIn()` 创建 NextAuth 会话**。前端收到成功响应，但浏览器无 session cookie，用户实际上未登录。
- **影响**：所有通过此 API 的登录均无效，用户始终处于未认证状态。

- **文件**：[src/app/api/auth/signout/route.ts](src/app/api/auth/signout/route.ts)
- **问题**：`POST` 检测到会话后直接返回 `{ success: true }`，**从未清除 cookie 或销毁 JWT**。
- **影响**：客户端以为已登出，实际上 token 仍然有效。

### 2. JWT 密钥使用占位符，可被伪造

- **文件**：[.env](.env)、[src/lib/auth.ts](src/lib/auth.ts)、[middleware.ts](middleware.ts)
- **问题**：
  ```
  AUTH_SECRET="azd9jcSX011UgGtbE6SNZALCCxFy24m4ctmrRAn4dow="    ← 真正的密钥
  NEXTAUTH_SECRET="replace-with-a-long-random-secret"               ← 占位符！
  ```
  - [auth.ts](src/lib/auth.ts) 未显式设置 `secret`，NextAuth v4 回退读取 `NEXTAUTH_SECRET`（占位符）
  - [middleware.ts](middleware.ts) 使用 `NEXTAUTH_SECRET || AUTH_SECRET`，先读到占位符
- **影响**：所有 JWT 可被任何人用已知占位符伪造，中间件 admin 保护形同虚设。

### 3. `next-auth` v4 与 `@auth/prisma-adapter` v2 不兼容

- **文件**：[package.json](package.json)、[prisma/schema.prisma](prisma/schema.prisma)
- **问题**：`next-auth: ^4.24.13` 是 NextAuth v4，`@auth/prisma-adapter: ^2.11.1` 是 Auth.js v5。二者 API 和数据库模型结构完全不同。
- **影响**：启动时适配器初始化将崩溃。

### 4. `.env` 包含真实生产环境密钥

- **文件**：[.env](.env)
- **问题**：
  - 明文包含 PostgreSQL 密码 (`XW147369258`)、七牛云 AK/SK、阿里百炼 API Key
  - `QINIU_ACCESS_KEY` (第17行) 尾部有空格，加载后值带空格导致认证失败
  - `DASHSCOPE_API_KEY` (第24行) 尾部也有空格
- **影响**：密钥泄露，需要立即轮换。空格问题导致七牛云和阿里百炼 API 调用失败。

### 5. Dockerfile 将密钥嵌入镜像层

- **文件**：[Dockerfile](Dockerfile)
- **问题**：`ARG` + `ENV` 将 `DATABASE_URL`、`AUTH_SECRET`、`NEXTAUTH_SECRET` 传入 `pnpm build`，写入镜像层。
- **影响**：任何人可通过 `docker history` 恢复密钥。

---

## 二、高严重度问题 (HIGH)

### 6. Docker 构建缺少必要环境变量

- **文件**：[Dockerfile:40-45](Dockerfile)
- **问题**：`pnpm build` 只传了 5 个变量，缺少 `QINIU_ACCESS_KEY`、`QINIU_SECRET_KEY`、`QINIU_BUCKET`、`QINIU_DOMAIN`、`QINIU_UPLOAD_URL`、`DASHSCOPE_API_KEY`、`DASHSCOPE_MODEL`、`DASHSCOPE_BASE_URL`。
- **影响**：构建失败或生产环境无法访问图床和 AI 服务。

### 7. 自定义 auth 路由缺少 CSRF 保护

- **文件**：[src/app/api/auth/login/route.ts](src/app/api/auth/login/route.ts)、[register/route.ts](src/app/api/auth/register/route.ts)、[signout/route.ts](src/app/api/auth/signout/route.ts)
- **问题**：自定义路由绕过了 NextAuth 内置的 CSRF token 校验。
- **影响**：恶意网站可发起跨站请求伪造攻击。

### 8. `NEXTAUTH_URL` 端口与 Dockerfile 不一致

- **文件**：[.env:6](.env)、[Dockerfile:58](Dockerfile)
- **问题**：`.env` 中 `NEXTAUTH_URL=http://localhost:3001`，Dockerfile 只暴露端口 3000 且 `next start` 默认运行在 3000。
- **影响**：生产环境认证回调 URL 指向错误端口。

---

## 三、中严重度问题 (MEDIUM)

### 9. 注册无邮箱验证

- **文件**：[src/app/api/auth/register/route.ts](src/app/api/auth/register/route.ts)、[prisma/schema.prisma](prisma/schema.prisma)
- **问题**：创建用户后立即可用，`User.emailVerified` 字段存在但从未被设置。
- **影响**：任何人都可用任意邮箱注册。

### 10. 密码复杂度太弱

- **文件**：[src/lib/validation.ts](src/lib/validation.ts)
- **问题**：只检查 `password.length >= 8`，无大小写/数字/特殊字符要求。
- **影响**：弱密码（如 `aaaaaaaa`）可通过验证。

### 11. 速率限制在 serverless 环境失效

- **文件**：[src/lib/rate-limit.ts](src/lib/rate-limit.ts)
- **问题**：`memory` 模式使用内存 Map 存储，serverless 每次调用都重置。无过期条目清理机制，会内存泄漏。
- **影响**：在 Vercel/AWS Lambda 部署时速率限制完全无效。

### 12. Prisma CLI 放在生产依赖中

- **文件**：[package.json](package.json)
- **问题**：`prisma` 应放在 `devDependencies` 而非 `dependencies`。
- **影响**：不必要地增大生产镜像体积。

### 13. NextAuth 数据模型缺少 `@@map`

- **文件**：[prisma/schema.prisma](prisma/schema.prisma)
- **问题**：`Account`、`Session`、`VerificationToken` 没有 `@@map("snake_case_name")`。
- **影响**：表名与其他模型命名风格不一致。

---

## 四、低严重度问题 (LOW)

### 14. `tsconfig.json` 编译目标保守

- **文件**：[tsconfig.json](tsconfig.json)
- **问题**：`target: "ES2017"` 会降级可选链、空值合并等现代语法，Node.js 20 原生支持 ES2023。

### 15. `dotenv` 冗余依赖

- **文件**：[package.json](package.json)
- **问题**：Next.js 原生加载 `.env` 文件，不需要 `dotenv`。

### 16. `set-admin` 路由是死代码

- **文件**：[src/app/api/admin/set-admin/route.ts](src/app/api/admin/set-admin/route.ts)
- **问题**：永远返回 404，应该清理或实现。

---

## 总结

| 严重度 | 数量 | 核心问题 |
|--------|------|----------|
| 致命 | 5 | 登录无效、JWT 可伪造、库版本不兼容、密钥泄露、Docker 密钥嵌入 |
| 高 | 3 | Docker 缺少环境变量、无 CSRF 保护、端口不匹配 |
| 中 | 5 | 无邮箱验证、密码弱、速率限制问题、依赖放置错误、模型命名 |
| 低 | 3 | TS 编译目标、冗余依赖、死代码 |

**最紧急**：修复 #1（登录流程）和 #2（JWT 密钥），这两个导致认证系统完全失效。#3 会导致启动崩溃。#4 和 #5 是安全合规问题，密钥需立即轮换。
