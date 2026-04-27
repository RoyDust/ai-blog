# 计划：项目重大问题分级修复

> **For Codex:** Execute this plan by severity. Keep changes small, test-backed, and reversible. Use checkbox (`- [ ]`) syntax for implementation tracking. Do not copy real secrets into docs, commits, tests, or logs.

**Goal:** 基于 `docs/project-major-issues-analysis.md` 的 DeepSeek 分析和当前代码核验结果，按严重程度修复真实存在的问题，降低认证、密钥、部署和注册安全风险，同时避免把误报或低价值清理项混入高优先级修复。

**Tech Stack:** Next.js 16 App Router, NextAuth v4, React 19, Prisma 7, PostgreSQL, Docker Compose, TypeScript, Vitest.

---

## Triage Summary

DeepSeek 报告中有真实问题，但部分结论需要修正：

- 登录页主流程使用 NextAuth `signIn("credentials")`，不是自定义 `/api/auth/login`，所以“所有登录完全无效”是过度推断。
- 自定义 `/api/auth/login` 与 `/api/auth/signout` 本身确实不会创建/销毁 NextAuth session，应删除或改造，避免误用。
- 本地 `.env` 未被 git 跟踪，但 `docs/project-major-issues-analysis.md` 已被 git 跟踪，且文档中包含敏感值片段；这比 `.env` 是否入库更直接。
- `NEXTAUTH_SECRET` 当前本地值是占位符，且中间件优先读取 `NEXTAUTH_SECRET`，会覆盖有效的 `AUTH_SECRET`。
- Docker build 阶段通过 build args 传入 secret 的风险成立。
- `@auth/prisma-adapter` v2 与 `next-auth` v4 “必然启动崩溃”的证据不足；当前更应该用认证集成测试和实际启动验证来确认兼容性。
- 生产限流默认走 database，不是报告所说的纯内存限流；但限流表缺少过期记录清理。
- `dotenv` 不是纯冗余依赖，`prisma.config.ts` 正在使用 `dotenv/config`。

---

## Severity Model

- **P0 / Immediate:** 已经造成秘密暴露、认证边界可被弱配置绕过，或会影响当前部署安全。
- **P1 / High:** 认证行为混乱、部署链路存在 secret 泄漏风险、配置会导致生产功能失效。
- **P2 / Medium:** 产品安全或运行稳定性需要增强，但不构成当前阻断。
- **P3 / Low:** 清理、文档、低风险一致性优化。

---

## P0 - Immediate Secret And Auth Boundary Fixes

### P0.1 脱敏已跟踪的问题分析文档

**Status:** Implemented locally; external secret rotation still requires operator confirmation if the sensitive report was pushed or shared.

**Evidence:**

- `docs/project-major-issues-analysis.md` 已被 git 跟踪。
- 文档中包含真实密钥片段、数据库密码片段和第三方服务密钥描述。
- `.env` 当前未被 git 跟踪，但文档把敏感信息搬进了仓库内容。

**Tasks:**

- [x] 删除 `docs/project-major-issues-analysis.md` 中所有真实密钥、密码、token、AK/SK、API key 片段。
- [x] 用占位符替换示例，例如 `<redacted-auth-secret>`、`<redacted-database-password>`。
- [x] 在文档顶部补充说明：分析报告不得记录真实 secret。
- [x] 搜索 `docs/`、根目录配置和测试夹具，确认没有同类真实 secret。
- [ ] 如果该文档已推送到远端或分享给第三方，记录需要轮换的 secret 类型，但不要在文档里写具体值。

**Acceptance Criteria:**

- `rg -n "真实密钥特征|数据库密码片段|第三方 API key 片段" docs` 不再命中真实值。
- `docs/project-major-issues-analysis.md` 保留问题描述，但不包含可用于认证的实际值。

**Verification:**

- `rg -n "AUTH_SECRET=|NEXTAUTH_SECRET=|DATABASE_URL=|QINIU_ACCESS_KEY|QINIU_SECRET_KEY|DASHSCOPE_API_KEY|API_KEY|ACCESS_KEY|SECRET|PASSWORD" docs`
- 人工确认输出只包含占位符或变量名，不包含真实值。

### P0.2 统一认证 secret 来源

**Status:** Implemented.

**Evidence:**

- `src/lib/auth.ts` 未显式设置 `secret`。
- `middleware.ts` 使用 `process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET`。
- 本地 `.env` 同时存在 `AUTH_SECRET` 和占位符式 `NEXTAUTH_SECRET`，中间件会优先选择占位符。

**Tasks:**

- [x] 新增统一的认证 secret 解析函数，例如 `resolveAuthSecret()`。
- [x] 解析规则优先拒绝明显占位符值，避免 `replace-with-*`、`placeholder`、`changeme` 等被当作有效 secret。
- [x] `authOptions.secret` 显式使用统一解析结果。
- [x] `middleware.ts` 使用同一个解析规则或同等逻辑。
- [x] 测试覆盖：`NEXTAUTH_SECRET` 是占位符且 `AUTH_SECRET` 有效时，应使用 `AUTH_SECRET`。
- [x] 测试覆盖：生产环境没有有效 secret 时应失败或返回明确错误，不应静默使用弱默认值。

**Acceptance Criteria:**

- NextAuth 与中间件使用同一个有效 secret。
- 占位符 secret 不会覆盖有效 secret。
- 认证相关测试能证明 admin middleware 与 session 解码一致。

**Verification:**

- `pnpm test -- src/__tests__/middleware.test.ts`
- 认证 helper 新增单元测试。
- 手动登录后台后刷新 `/admin` 和 `/api/admin/posts` 均能通过鉴权。

---

## P1 - High Priority Auth And Deployment Fixes

### P1.1 收敛自定义 auth login/signout 路由

**Status:** Partially confirmed.

**Evidence:**

- 主登录页 `src/app/(auth)/login/page.tsx` 使用 `signIn("credentials")`。
- `src/app/api/auth/login/route.ts` 校验密码后只返回用户 JSON，不创建 NextAuth session。
- `src/app/api/auth/signout/route.ts` 只返回成功 JSON，不清除 NextAuth session。
- 当前代码搜索未发现前端调用 `/api/auth/login` 或 `/api/auth/signout`，但这些路由存在误用风险。

**Tasks:**

- [ ] 删除自定义 `/api/auth/login` 与 `/api/auth/signout` 路由，或改为返回 404/410 并指向 NextAuth 主流程。
- [ ] 保留 `/api/auth/[...nextauth]` 作为唯一登录/登出 session 管理入口。
- [ ] 更新或新增测试，证明废弃路由不会产生伪登录成功响应。
- [ ] 检查 UI 中所有登录/登出入口，确保只使用 `next-auth/react` 的 `signIn` / `signOut`。

**Acceptance Criteria:**

- 不再存在“返回 success 但无 session”的 login API。
- 不再存在“返回 success 但不销毁 session”的 signout API。
- 登录页、用户导航、退出按钮保持可用。

**Verification:**

- `rg -n "/api/auth/(login|signout)|api/auth/login|api/auth/signout" src`
- `pnpm test -- src/__tests__/middleware.test.ts src/components/__tests__/UserNav.test.tsx`
- 手动登录/退出一次，确认 session cookie 行为符合预期。

### P1.2 移除 Docker build 阶段 secret 注入

**Status:** Confirmed.

**Evidence:**

- `Dockerfile` 在 builder 阶段声明 `ARG DATABASE_URL`、`ARG AUTH_SECRET`、`ARG NEXTAUTH_SECRET`。
- `docker-compose.prod.yml` 通过 build args 传入这些变量。
- `pnpm build` 阶段会接收 secret，存在进入构建缓存、镜像历史或构建日志的风险。

**Tasks:**

- [ ] 从 Docker build args 中移除 `DATABASE_URL`、`AUTH_SECRET`、`NEXTAUTH_SECRET`。
- [ ] 尽量让 `pnpm build` 不依赖真实数据库和真实认证 secret。
- [ ] 如果 build 确实需要公开站点 URL，仅传非 secret 的 `NEXT_PUBLIC_SITE_URL` / `NEXTAUTH_URL`。
- [ ] 将运行时 secret 仅保留在 `env_file` 或部署平台运行时环境变量。
- [ ] 增加 Dockerfile / compose contract 测试，禁止 secret 作为 build args。

**Acceptance Criteria:**

- `docker-compose.prod.yml` 的 `build.args` 不再包含 secret。
- `Dockerfile` builder 阶段不再声明或使用 secret args。
- 运行时容器仍能从 `.env` 读取数据库、认证、七牛、AI 配置。

**Verification:**

- `rg -n "ARG (DATABASE_URL|AUTH_SECRET|NEXTAUTH_SECRET)|DATABASE_URL=.*pnpm build|AUTH_SECRET=.*pnpm build|NEXTAUTH_SECRET=.*pnpm build" Dockerfile docker-compose.prod.yml`
- `pnpm test -- src/lib/__tests__/dockerfile-proxy-guard.test.ts src/lib/__tests__/deploy-remote-script.test.ts`
- 在可用环境中执行 `docker compose -f docker-compose.prod.yml build`。

### P1.3 修正部署环境变量校验与端口配置

**Status:** Partially confirmed.

**Evidence:**

- 本地 `.env` 的 `NEXTAUTH_URL` 指向 `localhost:3001`。
- Docker 暴露并映射 3000。
- `next.config.ts` 构建期读取 `QINIU_DOMAIN` 以加入 `next/image` remotePatterns。
- 七牛 AK/SK 与 AI API key 多数在运行时 API 中读取，不一定需要构建期传入。

**Tasks:**

- [ ] 将本地/部署 `.env` 中 `NEXTAUTH_URL` 与实际服务端口统一。
- [ ] 在部署脚本中校验 `NEXTAUTH_URL`、`NEXT_PUBLIC_SITE_URL` 与生产访问域名一致。
- [ ] 判断 `QINIU_DOMAIN` 是否必须作为 build-time public image domain；如必须，单独以非 secret build arg 或固定配置处理。
- [ ] 部署脚本补充运行时必需变量校验：Qiniu 上传配置、AI 环境模型配置。
- [ ] 对尾随空格敏感的变量在读取时 `.trim()`，或在部署脚本中拒绝尾随空格。

**Acceptance Criteria:**

- Docker 生产服务端口、`NEXTAUTH_URL` 和反向代理配置一致。
- 构建期只接收非 secret 配置。
- 上传和 AI 功能在运行时缺配置时给出明确错误。

**Verification:**

- `pnpm test -- src/app/api/admin/uploads/__tests__/qiniu-token.test.ts src/lib/__tests__/ai-models.test.ts`
- 部署脚本 dry-run 或 shellcheck 类检查。

---

## P2 - Medium Priority Product Security And Operations

### P2.1 注册邮箱验证或注册策略收敛

**Status:** Confirmed by code, product decision needed.

**Evidence:**

- `User.emailVerified` 字段存在。
- `/api/auth/register` 创建用户后未设置或验证 `emailVerified`。
- 注册后用户默认 `USER`，后台仍需 admin role，但公开用户系统允许任意邮箱注册。

**Options:**

- [ ] 选项 A：增加邮箱验证流程，未验证用户不能登录或不能执行敏感操作。
- [ ] 选项 B：关闭公开注册，只允许管理员创建账号或邀请码注册。
- [ ] 选项 C：保留公开注册，但明确限制未验证用户能力。

**Acceptance Criteria:**

- 产品策略明确写入文档。
- 代码行为与策略一致。
- 注册测试覆盖新策略。

### P2.2 提升密码策略

**Status:** Confirmed.

**Evidence:**

- `parseRegisterInput` 只校验长度至少 8。
- 注册页也只做同样的长度检查。

**Tasks:**

- [ ] 定义密码策略，例如长度至少 12，包含字母和数字，拒绝全重复字符。
- [ ] 后端 `parseRegisterInput` 实施策略。
- [ ] 前端注册页同步提示。
- [ ] 测试覆盖弱密码拒绝与合理密码通过。

**Acceptance Criteria:**

- 后端是唯一可信校验点。
- 前端提示与后端策略一致。

**Verification:**

- `pnpm test -- src/lib/__tests__/validation.test.ts`
- 注册页测试或手动验证。

### P2.3 限流表过期清理

**Status:** Partially confirmed.

**Evidence:**

- 生产默认使用 database rate limiter。
- `rate_limit_entries` 会 upsert，但未看到过期记录清理。

**Tasks:**

- [ ] 增加轻量清理策略：周期性删除 `reset_at < NOW() - interval '...'` 的旧记录。
- [ ] 避免每个请求都执行重清理；可用概率触发或部署任务。
- [ ] 测试覆盖 database limiter 路径仍正常返回。

**Acceptance Criteria:**

- 高流量下 `rate_limit_entries` 不会无限增长。
- 清理不会明显增加请求延迟。

**Verification:**

- `pnpm test -- src/lib/__tests__/rate-limit.test.ts`

### P2.4 认证兼容性验证

**Status:** Unknown / evidence insufficient.

**Evidence:**

- `next-auth` v4 与 `@auth/prisma-adapter` v2 当前能通过类型强转编译路径，但报告中“必崩”的结论缺少仓库内运行证据。
- `@auth/prisma-adapter` v2 返回的是 `@auth/core/adapters` 类型，代码中强转为 `next-auth/adapters` 的 `Adapter`。

**Tasks:**

- [ ] 增加最小认证集成测试，覆盖 credentials 登录成功、session 可读、middleware 可解码 admin token。
- [ ] 如果测试或实际运行证明适配器不兼容，再迁移到与 NextAuth v4 更明确匹配的 adapter 或升级 Auth.js 全套。
- [ ] 移除不必要的类型强转，或用注释解释兼容边界。

**Acceptance Criteria:**

- 认证兼容性由测试证明，而不是仅靠依赖名判断。
- 若迁移依赖，锁文件和 schema 变化可回滚。

---

## P3 - Low Priority Cleanup

### P3.1 NextAuth 模型表名一致性

**Status:** Low risk cleanup.

**Tasks:**

- [ ] 判断是否需要给 `Account`、`Session`、`VerificationToken` 增加 `@@map`。
- [ ] 如果已有生产表名，先确认迁移不会重命名/丢表。
- [ ] 只在明确需要统一命名时执行。

### P3.2 TypeScript target

**Status:** Low risk cleanup.

**Tasks:**

- [ ] 评估 `target` 从 `ES2017` 提升到更现代版本的影响。
- [ ] 运行 lint、test、build，确认无打包或运行时回退需求。

### P3.3 set-admin 禁用路由处理

**Status:** Intentionally disabled.

**Tasks:**

- [ ] 如果不再需要，删除 `src/app/api/admin/set-admin/route.ts` 和对应测试。
- [ ] 如果保留，补充注释说明这是刻意禁用的危险功能占位。

### P3.4 Prisma CLI 依赖位置

**Status:** Do not change until Docker runtime strategy is decided.

**Evidence:**

- 生产 Docker runner 阶段执行 `pnpm prisma generate`。
- 部署脚本在运行中执行 `pnpm prisma migrate deploy` 或 `pnpm prisma db push`。

**Decision:**

- [ ] 只有当迁移/生成从运行时镜像移到 CI/CD 或 builder 阶段后，才考虑把 `prisma` 移回 `devDependencies`。

---

## Execution Order

1. **P0.1 文档脱敏和 secret 轮换清单。**
2. **P0.2 认证 secret 统一解析。**
3. **P1.1 移除或废弃自定义 login/signout。**
4. **P1.2 Docker build secret 移除。**
5. **P1.3 部署 env 校验和端口统一。**
6. **P2.1/P2.2 注册策略与密码策略。**
7. **P2.3 限流清理。**
8. **P2.4 认证兼容性测试。**
9. **P3 清理项按需处理。**

---

## Global Acceptance Criteria

- 文档、提交信息、测试和日志不包含真实 secret。
- 登录、登出、admin middleware 和 `/api/admin/*` 鉴权路径行为一致。
- Docker build 阶段不接收 secret；secret 只在运行时注入。
- 上传和 AI 配置的错误可诊断，不再因尾随空格或缺变量表现为模糊失败。
- 所有改动均有回归测试或明确的手动验证记录。

---

## Verification Checklist

- [ ] `pnpm lint`
- [ ] `pnpm test`
- [ ] `pnpm exec tsc --noEmit --pretty false`，若当前基线仍失败，需要记录失败文件并区分是否本计划引入。
- [ ] `rg -n "真实 secret 特征" docs src Dockerfile docker-compose.prod.yml scripts`
- [ ] 手动验证登录、退出、访问 `/admin`、访问 `/api/admin/posts`。
- [ ] 如有 Docker 环境，执行 `docker compose -f docker-compose.prod.yml build` 和一次启动验证。

---

## Known Limits

- 本计划不会在文档中记录真实密钥值；如果需要轮换，应该在密钥管理系统或部署平台中完成。
- `.env` 是本地忽略文件，本计划只能指出当前本地配置问题，不能证明远端部署环境是否同样错误。
- `next-auth` adapter 兼容性需要运行级测试验证；当前仅凭仓库证据不能断言“必崩”。
