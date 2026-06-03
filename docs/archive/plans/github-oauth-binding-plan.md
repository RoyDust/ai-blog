# GitHub OAuth 接入与账户绑定实施方案

> **版本**: v1.1  
> **日期**: 2026-05-08  
> **状态**: 待实施  
> **涉及模块**: 认证系统、用户账户、前端 UI  
> **审查修订**: 已修正 NextAuth v4 账户关联、JWT 状态、CSRF、Prisma 字段不匹配等问题

---

## 一、目标概述

实现两个核心功能：

| 功能 | 描述 |
|---|---|
| **GitHub OAuth 注册/登录** | 新用户可通过 GitHub 授权创建账号并登录 |
| **已有账户绑定 GitHub** | 已登录用户可在设置页面显式绑定/解绑 GitHub 账号 |

---

## 二、当前项目现状

### 2.1 已有基础设施

| 组件 | 文件 | 状态 |
|---|---|---|
| NextAuth 配置 | `src/lib/auth.ts` | ✅ 已配置 `GitHubProvider`，但凭证为空 |
| Prisma Adapter | `@auth/prisma-adapter` | ✅ 已集成 |
| Account 模型 | `prisma/schema.prisma` | ✅ 已存在标准 NextAuth Account 表 |
| User 与 Account 关系 | `prisma/schema.prisma` | ✅ `User.accounts Account[]` 已存在 |
| 会话策略 | `src/lib/auth.ts` | ✅ JWT 策略 |
| 登录页 | `src/app/(auth)/login/page.tsx` | ⚠️ 需添加 GitHub 登录按钮和错误提示 |
| 注册页 | `src/app/(auth)/register/page.tsx` | ⚠️ 需添加 GitHub 注册按钮 |
| 设置页 | `src/app/admin/settings/page.tsx` | ⚠️ 需添加绑定状态查询 |
| 解绑接口 | 无 | ❌ 需新增 |

### 2.2 关键依赖版本

```json
{
  "next-auth": "^4.24.13",
  "@auth/prisma-adapter": "^2.11.1"
}
```

> 当前项目使用的是 **NextAuth v4**，不是 Auth.js v5。本文方案按 NextAuth v4 设计。

---

## 三、关键设计原则

### 3.1 不依赖邮箱自动合并 OAuth 账号

NextAuth v4 出于安全考虑，默认不应假设“GitHub 邮箱与已有用户邮箱相同就会自动绑定”。

安全策略：

| 场景 | 处理策略 |
|---|---|
| GitHub Account 已存在 | 正常登录 |
| GitHub Account 不存在，邮箱也不存在 | 创建新用户 |
| GitHub Account 不存在，但邮箱已被本地账号占用 | 不自动绑定，提示用户先用邮箱密码登录，再到设置页绑定 GitHub |
| 用户已登录后点击绑定 GitHub | 显式绑定到当前登录用户 |

> 不建议启用 `allowDangerousEmailAccountLinking: true`，除非非常确认 GitHub 返回邮箱可信且已验证，并接受账号接管风险。

### 3.2 绑定状态以数据库为准，不以 JWT 为准

绑定状态应查询 `Account` 表，而不是依赖 `session.user.githubId`。

原因：

1. JWT 是登录时的快照，数据库状态变化后 JWT 不会自动同步。
2. 用户通过 credentials 登录时，JWT 中不会天然包含 GitHub 绑定状态。
3. 客户端 `session.update()` 传入的字段不应被作为可信身份状态。

推荐查询方式：

```ts
const githubLinked =
  (await prisma.account.count({
    where: {
      userId: session.user.id,
      provider: "github",
    },
  })) > 0
```

### 3.3 JWT 只记录当前登录会话必要信息

JWT 保持当前已有设计：

```ts
token.id
token.role
```

可选记录当前登录 provider：

```ts
token.provider = account.provider
```

但不建议把 `githubId` 作为绑定状态写入 JWT。

### 3.4 自定义解绑接口必须自行做 CSRF / Origin 防护

NextAuth 内置 CSRF 保护只覆盖 NextAuth 自身认证端点，不会自动保护自定义 API：

```txt
/api/account/github/unlink
```

因此解绑接口需要自行做 Origin 校验，或引入 CSRF Token 校验。

---

## 四、GitHub OAuth 登录/注册流程

### 4.1 普通 GitHub 登录流程

```txt
用户点击「使用 GitHub 登录」
  → signIn("github", { callbackUrl })
  → GitHub 授权
  → /api/auth/callback/github
  → NextAuth 处理 OAuth 回调
  → 若 Account 已存在：登录
  → 若 Account 不存在且邮箱可用：创建 User + Account
  → 若邮箱已被其他账号占用：返回 OAuthAccountNotLinked
  → 重定向 callbackUrl 或 /login?error=...
```

### 4.2 已有账号绑定 GitHub 流程

```txt
用户先通过邮箱密码登录
  → 进入设置页
  → 页面服务端查询 Account 表，显示 GitHub 绑定状态
  → 点击「绑定 GitHub」
  → signIn("github", { callbackUrl: "/admin/settings?github=linked" })
  → GitHub 授权
  → NextAuth 将 GitHub Account 显式绑定到当前登录用户
  → 回到设置页
  → 设置页重新查询数据库，展示最新绑定状态
```

### 4.3 解绑流程

```txt
用户点击「解除 GitHub 绑定」
  → 前端 POST /api/account/github/unlink
  → 服务端校验登录状态
  → 服务端校验 Origin / CSRF
  → 服务端确认该用户确实绑定了 GitHub
  → 服务端确认解绑后用户仍有其他登录方式
  → 删除 Account 记录
  → 前端刷新绑定状态
```

---

## 五、详细实施方案

## 阶段一：环境与 NextAuth 配置

### 5.1 配置 GitHub OAuth 环境变量

**文件**: `.env`

```env
AUTH_GITHUB_ID="你的 GitHub OAuth Client ID"
AUTH_GITHUB_SECRET="你的 GitHub OAuth Client Secret"
```

GitHub OAuth App 回调地址：

开发环境：

```txt
http://localhost:3001/api/auth/callback/github
```

生产环境：

```txt
https://你的域名/api/auth/callback/github
```

> 建议开发环境和生产环境分别创建 GitHub OAuth App。

### 5.2 调整 GitHubProvider scope

**文件**: `src/lib/auth.ts`

当前配置：

```ts
GitHubProvider({
  clientId: process.env.AUTH_GITHUB_ID || "",
  clientSecret: process.env.AUTH_GITHUB_SECRET || "",
})
```

建议修改为：

```ts
GitHubProvider({
  clientId: process.env.AUTH_GITHUB_ID || "",
  clientSecret: process.env.AUTH_GITHUB_SECRET || "",
  authorization: {
    params: {
      scope: "read:user user:email",
    },
  },
})
```

原因：GitHub 用户可能隐藏公开邮箱，需要 `user:email` 权限以便 NextAuth/GitHub Provider 获取可用邮箱。

### 5.3 增强 signIn 回调

**文件**: `src/lib/auth.ts`

目标：

1. 允许 credentials 登录。
2. GitHub 登录时，如果没有邮箱，拒绝并返回错误页。
3. 不启用危险的邮箱自动合并。
4. 绑定状态不在 `signIn` 中手动写 JWT。

建议回调：

```ts
callbacks: {
  async signIn({ user, account }) {
    if (account?.provider !== "github") {
      return true
    }

    // 当前 User.email 是必填字段，GitHub 必须提供可用邮箱
    if (!user.email) {
      return "/login?error=GitHubEmailRequired"
    }

    return true
  },

  async jwt({ token, user, account }) {
    if (user) {
      token.id = user.id
      token.role = (user as { role?: string }).role ?? "USER"
    }

    // 可选：只记录当前登录方式，不作为绑定状态依据
    if (account?.provider) {
      token.provider = account.provider
    }

    return token
  },

  async session({ session, token }) {
    if (session.user) {
      session.user.id = token.id as string
      session.user.role = token.role as string
      session.user.provider = token.provider as string | undefined
    }
    return session
  },
}
```

### 5.4 扩展类型声明

**文件**: `src/types/next-auth.d.ts`

只新增 `provider`，不新增 `githubId`：

```ts
import { DefaultSession, DefaultUser } from "next-auth"
import { DefaultJWT } from "next-auth/jwt"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      role: string
      provider?: string
    } & DefaultSession["user"]
  }

  interface User extends DefaultUser {
    role: string
    provider?: string
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string
    role: string
    provider?: string
  }
}
```

---

## 阶段二：登录/注册页面接入 GitHub 按钮

### 5.5 登录页添加 GitHub 登录按钮

**文件**: `src/app/(auth)/login/page.tsx`

当前文件已导入：

```ts
import { signIn } from 'next-auth/react'
```

添加 GitHub 按钮：

```tsx
<Button
  type="button"
  variant="outline"
  className="w-full gap-2 py-2.5"
  onClick={() => signIn("github", { callbackUrl })}
>
  使用 GitHub 登录
</Button>
```

同时完善错误提示：

```ts
const errorMessages: Record<string, string> = {
  OAuthAccountNotLinked: "该邮箱已注册，请先使用邮箱密码登录，然后在设置页绑定 GitHub。",
  GitHubEmailRequired: "GitHub 未返回可用邮箱，请在 GitHub 账号中添加并验证邮箱后重试。",
  Configuration: "GitHub 登录暂未正确配置，请联系管理员。",
}

const helperMessage = authError
  ? errorMessages[authError] ?? "登录失败，请稍后重试。"
  : ""
```

### 5.6 注册页添加 GitHub 注册按钮

**文件**: `src/app/(auth)/register/page.tsx`

新增导入：

```ts
import { signIn } from "next-auth/react"
```

添加按钮：

```tsx
<Button
  type="button"
  variant="outline"
  className="w-full"
  onClick={() => signIn("github", { callbackUrl: "/" })}
>
  使用 GitHub 注册/登录
</Button>
```

---

## 阶段三：GitHub 绑定状态查询

### 5.7 服务端查询绑定状态

优先在设置页服务端组件中查询数据库，避免客户端依赖过期 JWT。

**文件**: `src/app/admin/settings/page.tsx`

修改查询：

```ts
const user = session?.user?.id
  ? await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        accounts: {
          where: { provider: "github" },
          select: { providerAccountId: true },
        },
      },
    })
  : null
```

传给客户端前转换数据结构，不直接暴露 `accounts`：

```ts
const settingsUser = user
  ? {
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      githubLinked: user.accounts.length > 0,
    }
  : fallbackUser
```

`fallbackUser` 也需要补充：

```ts
const fallbackUser = {
  id: "unknown",
  name: "Admin",
  email: "admin@example.com",
  image: null,
  role: "ADMIN",
  githubLinked: false,
}
```

### 5.8 扩展设置页用户类型

**文件**: `src/components/admin/settings/AdminSettingsClient.tsx`

```ts
type SettingsUser = {
  id: string
  name: string | null
  email: string
  image: string | null
  role: string
  githubLinked: boolean
}
```

---

## 阶段四：新增 GitHub 解绑接口

### 5.9 新增 Origin 校验工具逻辑

**文件**: `src/app/api/account/github/unlink/route.ts`

完整建议实现：

```ts
import { getServerSession } from "next-auth"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

function normalizeOrigin(value: string | undefined) {
  if (!value) return null
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

function isAllowedOrigin(origin: string | null) {
  const allowedOrigins = [
    normalizeOrigin(process.env.NEXTAUTH_URL),
    normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL),
  ].filter(Boolean)

  return !!origin && allowedOrigins.includes(origin)
}

export async function POST() {
  const requestOrigin = headers().get("origin")

  if (!isAllowedOrigin(requestOrigin)) {
    return NextResponse.json({ error: "非法请求来源" }, { status: 403 })
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 })
  }

  const [user, githubAccount, otherAccountsCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true },
    }),
    prisma.account.findFirst({
      where: {
        userId: session.user.id,
        provider: "github",
      },
      select: { id: true },
    }),
    prisma.account.count({
      where: {
        userId: session.user.id,
        provider: { not: "github" },
      },
    }),
  ])

  if (!githubAccount) {
    return NextResponse.json({ error: "未绑定 GitHub 账号" }, { status: 400 })
  }

  if (!user?.password && otherAccountsCount === 0) {
    return NextResponse.json(
      { error: "解绑后你将无法登录，请先设置密码或绑定其他登录方式" },
      { status: 400 }
    )
  }

  await prisma.account.delete({
    where: { id: githubAccount.id },
  })

  return NextResponse.json({ success: true })
}
```

> 注意：这是最低限度的 Origin 防护。若后续有统一 CSRF 中间件，应将该接口纳入统一保护。

---

## 阶段五：新增 GitHub 绑定组件

### 5.10 新增组件

**文件**: `src/components/admin/settings/GitHubBinding.tsx`

建议放在后台设置组件目录下，保持 UI 风格一致。

```tsx
"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { toast } from "sonner"
import { Button } from "@/components/admin/ui"

type GitHubBindingProps = {
  initialLinked: boolean
}

export function GitHubBinding({ initialLinked }: GitHubBindingProps) {
  const [linked, setLinked] = useState(initialLinked)
  const [linking, setLinking] = useState(false)
  const [unlinking, setUnlinking] = useState(false)

  const handleLink = async () => {
    setLinking(true)
    await signIn("github", {
      callbackUrl: "/admin/settings?github=linked",
    })
  }

  const handleUnlink = async () => {
    if (!confirm("确定要解除 GitHub 绑定吗？")) return

    setUnlinking(true)
    try {
      const response = await fetch("/api/account/github/unlink", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || "解除绑定失败")
        return
      }

      setLinked(false)
      toast.success("GitHub 已解除绑定")
    } catch {
      toast.error("解除绑定失败，请稍后重试")
    } finally {
      setUnlinking(false)
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-4">
      <div>
        <p className="font-semibold text-[var(--foreground)]">GitHub 账号</p>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {linked ? "已绑定 GitHub，可使用 GitHub 登录。" : "绑定后可使用 GitHub 一键登录。"}
        </p>
      </div>

      {linked ? (
        <Button type="button" variant="outline" onClick={handleUnlink} disabled={unlinking}>
          {unlinking ? "解除中..." : "解除 GitHub 绑定"}
        </Button>
      ) : (
        <Button type="button" onClick={handleLink} disabled={linking}>
          {linking ? "跳转中..." : "绑定 GitHub 账号"}
        </Button>
      )}
    </div>
  )
}
```

### 5.11 集成到设置页客户端组件

**文件**: `src/components/admin/settings/AdminSettingsClient.tsx`

新增导入：

```ts
import { GitHubBinding } from "@/components/admin/settings/GitHubBinding"
```

在个人信息面板中加入：

```tsx
<div className="border-t border-[var(--border)] pt-4">
  <GitHubBinding initialLinked={user.githubLinked} />
</div>
```

建议放在头像、名称、邮箱编辑区域之后，保存按钮之前或之后均可。

---

## 六、不建议新增的内容

### 6.1 暂不新增 `/api/account/github/status`

由于设置页本身是服务端组件，可以直接查询数据库并传入 `githubLinked`，无需额外新增 status API。

只有在未来存在多个前端页面都需要动态查询绑定状态时，再新增：

```txt
GET /api/account/github/status
```

### 6.2 暂不保存 GitHub 用户名

当前 `Account.providerAccountId` 是 GitHub 用户 ID，不是 GitHub 用户名。

不建议显示为 username。

如未来需要展示 GitHub 用户名，可新增字段：

```prisma
githubUsername String?
githubAvatarUrl String?
```

或者新增 OAuthProfile 表。

### 6.3 暂不为 Account 增加 createdAt

当前 `Account` 模型没有：

```prisma
createdAt DateTime
```

本次功能不需要显示绑定时间，因此不改 schema。

---

## 七、文件变更清单

### 7.1 修改文件

```txt
.env
src/lib/auth.ts
src/types/next-auth.d.ts
src/app/(auth)/login/page.tsx
src/app/(auth)/register/page.tsx
src/app/admin/settings/page.tsx
src/components/admin/settings/AdminSettingsClient.tsx
```

### 7.2 新增文件

```txt
src/app/api/account/github/unlink/route.ts
src/components/admin/settings/GitHubBinding.tsx
```

### 7.3 暂不新增文件

```txt
src/app/api/account/github/status/route.ts
```

原因：当前设置页可直接服务端查询绑定状态，无需额外 API。

---

## 八、安全与边界情况

| 场景 | 处理方式 |
|---|---|
| GitHub 邮箱未公开 | 通过 `user:email` scope 尽量获取邮箱 |
| GitHub 无可用邮箱 | 拒绝登录，返回 `GitHubEmailRequired` |
| GitHub 邮箱已被本地账号使用 | 不自动合并，提示先用本地账号登录后绑定 |
| 一个 GitHub 已绑定用户 A，又尝试绑定用户 B | 数据库唯一索引 `@@unique([provider, providerAccountId])` 阻止 |
| 仅 GitHub 登录用户尝试解绑 | 如果无密码且无其他 OAuth，拒绝解绑 |
| 解绑接口 CSRF | 使用 Origin 校验，后续可升级为统一 CSRF Token |
| 绑定状态不同步 | 以数据库查询为准，不以 JWT 为准 |
| GitHub OAuth 凭证为空 | 登录按钮可保留，但登录会进入配置错误；也可按环境隐藏按钮 |

---

## 九、测试清单

### 9.1 登录/注册测试

- [ ] GitHub OAuth 凭证正确时，可以跳转 GitHub 授权页
- [ ] 新 GitHub 用户首次登录后，数据库创建 `User` 与 `Account`
- [ ] 已绑定 GitHub 的用户再次点击 GitHub 登录，可以正常登录
- [ ] GitHub 无可用邮箱时，返回友好错误提示
- [ ] GitHub 邮箱已被本地账号占用但未绑定时，显示 `OAuthAccountNotLinked` 友好提示

### 9.2 绑定测试

- [ ] 本地账号登录后，设置页显示 GitHub 未绑定
- [ ] 点击绑定 GitHub 后，回调到 `/admin/settings?github=linked`
- [ ] 绑定成功后，`Account` 表新增 `provider = github` 记录
- [ ] 绑定成功后，设置页刷新显示已绑定
- [ ] 已绑定后通过 credentials 登录，设置页仍正确显示已绑定

### 9.3 解绑测试

- [ ] 已绑定用户点击解绑，`Account` 表记录被删除
- [ ] 解绑后设置页显示未绑定
- [ ] 仅 GitHub 登录且无密码用户解绑时被拒绝
- [ ] 有密码用户解绑后仍可通过邮箱密码登录
- [ ] 伪造跨站 POST 请求时，Origin 校验拒绝请求

### 9.4 权限与页面测试

- [ ] 未登录用户不能调用解绑接口
- [ ] 普通 USER 若无法访问 `/admin/settings`，需考虑是否另建普通用户设置页
- [ ] ADMIN 用户可正常访问设置页并绑定/解绑
- [ ] OAuth 错误码在登录页有清晰提示

---

## 十、实施顺序

```txt
步骤 1: 配置 GitHub OAuth App 与 .env
步骤 2: 修改 src/lib/auth.ts，增加 GitHub scope 与回调处理
步骤 3: 修改 src/types/next-auth.d.ts，仅扩展 provider 字段
步骤 4: 修改登录页，添加 GitHub 登录按钮和 OAuth 错误提示
步骤 5: 修改注册页，添加 GitHub 注册/登录按钮
步骤 6: 修改 admin/settings 服务端查询，传入 githubLinked
步骤 7: 修改 AdminSettingsClient 用户类型并接入 GitHubBinding
步骤 8: 新增 GitHubBinding 组件
步骤 9: 新增 unlink API，并加入 Origin 校验与登录方式保护
步骤 10: 执行完整手工测试与 lint/build 检查
```

---

## 十一、生产环境注意事项

1. 开发环境与生产环境应使用不同 GitHub OAuth App。
2. 生产环境回调 URL 必须是 HTTPS：

```txt
https://你的域名/api/auth/callback/github
```

3. `NEXTAUTH_URL` 必须与实际生产域名一致。
4. `AUTH_SECRET` 必须使用强随机值。
5. 自定义解绑接口不能依赖 NextAuth 自带 CSRF，需要自己的 Origin/CSRF 校验。
6. 不要把 `providerAccountId` 当作 GitHub 用户名展示。
7. 不要开启 `allowDangerousEmailAccountLinking`，除非已完成专门安全评估。

---

## 十二、后续可选增强

| 增强项 | 说明 |
|---|---|
| 普通用户设置页 | 当前 `/admin/settings` 仅后台可访问，普通用户如果也要绑定 GitHub，应新增 `/settings/account` |
| 设置密码功能 | 允许纯 GitHub 用户设置本地密码后再解绑 GitHub |
| OAuthProfile 表 | 保存 GitHub username、avatar、绑定时间等展示信息 |
| 统一 CSRF 中间件 | 为所有敏感自定义 POST/DELETE API 提供统一保护 |
| 绑定审计日志 | 记录绑定/解绑时间、IP Hash、UserAgent |
