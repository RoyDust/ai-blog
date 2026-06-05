# 项目重构与技术债清理计划

> 分析日期：2026-05-09（Asia/Shanghai）  
> 最近复核：2026-05-09  
> 范围：全项目审查与计划修订；本文件只改文档，不改源码  
> 目标：清除冗余、抽象可复用方法、统一边界、保持行为不变

## 结论

项目当前可以 lint、typecheck、unit test、production build，但 e2e 基线已经落后于真实 UI。重构前应先修复 e2e 与少量配置契约，否则后续清理无法可靠证明“不改行为”。

第一优先级不是大规模拆文件，而是建立可信行为锁：修复 Playwright 断言、修正 Next Image quality 配置告警、确认认证和部署边界。随后再按 API 边界、客户端请求封装、大组件拆分、AI 领域拆分、UI primitive 收敛、仓库卫生的顺序推进。

## 已验证基线

| 检查 | 结果 | 说明 |
| --- | --- | --- |
| `pnpm lint` | PASS | ESLint 通过 |
| `pnpm exec tsc --noEmit --incremental false --pretty false` | PASS | TypeScript 通过 |
| `pnpm test` | PASS | 160 个测试文件、503 个测试通过 |
| `pnpm build` | PASS | Next.js 16.1.6 production build 通过，生成 98 个静态页面 |
| `pnpm test:e2e` | FAIL | 3 个 Playwright 测试全部失败，详见 Phase 0 |

## 量化现状

| 指标 | 当前值 | 含义 |
| --- | ---: | --- |
| API route handlers | 50 | `src/app/api/**/route.ts` 数量较多，统一边界收益高 |
| 测试文件 | 160 | 单元/组件/API 覆盖较充足，可支撑渐进重构 |
| `"use client"` 文件 | 72 | 客户端组件较多，fetch/helper 与状态拆分收益高 |
| `toErrorResponse` 命中 | 106 | 已有统一错误出口，11 个路由文件完全未使用（改用裸 `NextResponse.json`） |
| 局部客户端错误 helper | 16 | `getErrorMessage` / `readError` / `readJson` 在 16 个后台文件中重复 |
| 已跟踪工具/工作流 artifact | 68 | `.codex`、`.opencode`、`.sisyphus`、临时文件等需要归档策略 |

主要大文件：

- `src/lib/ai-news.ts`：1088 行
- `src/components/posts/AdminPostWorkspace.tsx`：781 行
- `src/lib/ai-models.ts`：892 行
- `src/lib/ai-post-actions.ts`：591 行
- `src/lib/ai-authoring.ts`：582 行
- `src/components/admin/ai/AiModelManager.tsx`：544 行
- `src/app/admin/page.tsx`：519 行
- `src/components/admin/taxonomy/TaxonomyStudio.tsx`：488 行
- `src/lib/validation.ts`：488 行

## 关键发现

### 1. e2e 基线失效，必须先修

证据：

- `e2e/admin.spec.ts` 期望 `/admin` 重定向到 `/login` 或根路径；实际 URL 是 `/?login=1&callbackUrl=%2Fadmin`。
- `e2e/author.spec.ts` 期望 `/write` 有标题 `创作工作台`，当前未找到。
- `e2e/reader.spec.ts` 期望 `/posts` 有标题 `内容探索`，当前未找到。

影响：

- 后续 UI 与路由重构无法依赖 Playwright 证明行为保持。
- 这些失败更像测试断言过期，不是 build 或运行时崩溃。

处理：

- Phase 0 先更新 e2e 到当前产品契约，或把 UI 恢复到测试所描述的契约。
- 不允许在后续阶段用“e2e 已知失败”作为常态跳过。

### 2. Next Image quality 配置与组件使用不一致

证据：

- `next.config.ts` 中 `images.qualities` 为 `[70, 75]`。
- `src/components/blog/HomeLatestPosts.tsx` 与 `src/components/blog/PostCard.tsx` 使用 `quality={72}`。
- Playwright web server 输出 Next 警告：quality `72` 未配置。

影响：

- 当前 build 通过，但 dev/e2e 有运行时告警。
- Next 后续版本可能把该警告升级为更强约束。

处理：

- 最小修复是把 `72` 加入 `images.qualities`，或把组件质量值改为已有 `70` / `75`。
- 增加/更新 `src/__tests__/next-config-images.test.ts`，锁定 quality 契约。

### 3. API 边界已有基础设施，但执行不一致

证据：

- `src/lib/api-errors.ts` 已提供 `ApiError` / `ValidationError` / `toErrorResponse`。
- `src/lib/api-auth.ts` 已提供 `requireSession` / `requireAdminSession`。
- 后台 `categories`、`tags`、`posts`、`comments` route 重复定义 `parseIds`。
- 公开 `src/app/api/categories/route.ts` 和 `src/app/api/tags/route.ts` 仍有局部 `requireAdmin` 与裸 `request.json()`。

影响：

- 错误契约、鉴权契约和输入解析分散，后续功能容易继续复制旧模式。

处理：

- 抽 `parseIdList(searchParams)`。
- 统一 route 成功响应和错误响应策略。
- 保留“公共 GET 不应因 auth 配置失败而崩”的设计时，需要写明边界，而不是复制局部鉴权。

### 4. 后台客户端请求处理重复

证据：

以下 16 处存在局部错误解析或 JSON 读取（实际覆盖超过计划原估计的 10 处）：

- `src/app/admin/ai-news/page.tsx`
- `src/app/admin/comments/page.tsx`
- `src/app/admin/posts/page.tsx`
- `src/components/admin/ai/AiModelManager.tsx`
- `src/components/admin/ai/AiTaskDetail.tsx`
- `src/components/admin/ai/BulkAiCompletionDialog.tsx`
- `src/components/admin/ai/PostAiWorkspace.tsx`
- `src/components/admin/covers/AiCoverGenerator.tsx`
- `src/components/admin/covers/CoverAssetForm.tsx`
- `src/components/admin/covers/CoverGalleryManager.tsx`
- `src/components/admin/covers/CoverPicker.tsx`
- `src/components/admin/notifications/NotificationBell.tsx`
- `src/components/admin/notifications/NotificationCenterClient.tsx`
- `src/components/admin/settings/AdminSettingsClient.tsx`
- `src/components/admin/settings/GitHubBinding.tsx`
- `src/components/admin/taxonomy/TaxonomyStudio.tsx`

影响：

- 每个页面重复处理 `response.ok`、`success`、`error` 字段和 fallback 文案。
- 修改 API 响应契约时需要多点同步。

处理：

- 新增轻量 client API helper，不引入状态库。
- 先迁移 posts/comments/taxonomy，再迁移 AI/covers/settings。

### 5. 大组件职责过宽

证据：

- `src/components/posts/AdminPostWorkspace.tsx` 同时处理表单状态、分类标签加载、编辑加载、slug 自动生成、摘要、元数据、封面上传、保存、布局。
- `src/components/admin/taxonomy/TaxonomyStudio.tsx` 同时包含分类和标签两套相似列表/表单/删除预览逻辑。
- `src/components/admin/ai/AiModelManager.tsx` 同时包含模型列表、表单、测试、默认切换、删除、错误处理。

影响：

- 单文件状态过多，后续改动容易产生隐性回归。

处理：

- 优先抽 hook 和纯 helper，不先改 UI 结构。
- 每次只迁移一种职责，例如先抽封面上传，再抽 AI 元数据。

### 6. AI 领域服务过宽，但已有测试基础

证据：

- `src/lib/ai-news.ts` 包含 feed parsing、candidate 持久化、评分选择、草稿生成、run 编排。
- 已存在 `ai-news-fetchers`、`ai-news-candidates`、`ai-news-scoring` 等邻近模块，说明拆分方向已经开始形成。
- AI 相关单测丰富：`src/lib/__tests__/ai-news.test.ts`、`ai-news-fetchers.test.ts`、`ai-news-candidates.test.ts`、`ai-news-scoring.test.ts`、`ai-models.test.ts` 等。

影响：

- 大文件成为变更热点，但可以通过纯函数迁移降低风险。

处理：

- 保持 `ai-news.ts` facade，不一次性改外部调用。
- 先迁移纯解析/格式化/映射函数，再迁移带 Prisma 或 fetch 副作用的流程。

### 7. UI primitive 双轨

证据：

- 公共 `src/components/ui/Button.tsx` 与后台 `src/components/admin/ui/button.tsx` 各自定义变体。
- 公共 `src/components/ui/Card.tsx` 与后台 `src/components/admin/ui/card.tsx` 各自定义结构。
- 后台 UI 使用 CVA/asChild 能力更完整，公共 UI 更轻。

影响：

- 设计 token 和交互状态可能漂移。

处理：

- 先确立 canonical primitive 层，再逐步让另一套变成薄 wrapper 或 re-export。
- 不做全站视觉重设计。

### 8. 认证和部署债务需要专项处理

证据：

- `Dockerfile` builder 阶段声明 `ARG DATABASE_URL`、`ARG AUTH_SECRET`、`ARG NEXTAUTH_SECRET`。
- `docker-compose.prod.yml` 通过 `build.args` 传入这些 secret。
- `src/app/api/auth/login/route.ts` 校验密码后返回用户信息，但不会创建 NextAuth session。已确认：前端 `LoginForm.tsx` 通过 NextAuth 的 `signIn("credentials", ...)` 登录，**不存在任何前端代码直接 fetch `/api/auth/login`**。该路由是孤立端点，对外表现为"可用但无 session"的误导接口。
- `src/lib/__tests__/auth-routes.test.ts` 已确认不存在独立 signout route，signout 由 NextAuth catch-all 管理。
- `src/lib/auth.ts` 使用 `@auth/prisma-adapter` 并强转为 `next-auth/adapters` 的 `Adapter`。
- `src/lib/ai-models.ts` 使用 AES-256-GCM 加密存储 AI 模型 API key，加密密钥优先级为：`AI_MODEL_SECRET_KEY` → `AUTH_SECRET` → `NEXTAUTH_SECRET`。这意味着若因安全事件轮换 `AUTH_SECRET`，所有已存储的 AI API key 将无法解密，产生级联故障。

影响：

- Docker build secret 是生产安全边界问题。
- `/api/auth/login` 因无前端调用方而成为孤立误导端点，删除风险极低。
- Auth adapter 兼容性不能只靠类型通过判断，需要运行级验证或专项 ADR。
- AI API key 加密与 auth secret 耦合，auth secret 轮换前须先迁移 AI key 加密密钥源。

处理：

- Docker secret build args 优先移除。
- `/api/auth/login` 已确认无前端调用方，可直接删除或返回 410；删除前 grep 确认无外部脚本或文档引用。
- Auth 依赖迁移独立做 ADR，不混入普通 cleanup。
- 在 Phase 5 拆分 `ai-models.ts` 时，将加密密钥源（`AI_MODEL_SECRET_KEY`）与 auth secret 解耦，并补充密钥轮换文档。

### 9. 配置与依赖清理有误报风险

证据：

- `tsconfig.json` 当前为 `target: "ES2017"`、`allowJs: true`、`skipLibCheck: true`。
- `dotenv` 不是纯冗余：`prisma.config.ts`、多个 `scripts/*.cjs` 正在使用。
- `next.config.ts` 在 `images` 块内设置了 `dangerouslyAllowLocalIP: true`，这是 Next.js Image Optimization 的配置项，仅允许 `<Image>` 组件从 `localhost/127.0.0.1` 地址加载图片，**不影响通用网络权限或请求来源校验**。生产环境若无本地托管图片，可安全关闭。

影响：

- 简单删除 `dotenv` 会破坏 Prisma 或脚本。
- TS 配置收紧可能暴露第三方类型或构建差异，不能和业务重构混提交。
- `images.dangerouslyAllowLocalIP` 生产影响有限，但应补充注释说明用途。

处理：

- 配置清理单独阶段推进。
- 每个配置项先写”保留理由或替代方案”，再改。
- `dangerouslyAllowLocalIP` 建议改为仅在 `process.env.NODE_ENV !== “production”` 时启用，或补注释说明保留原因。

### 10. 仓库卫生需要策略，不应随手删

证据：

- 已跟踪 `.codex`、`.opencode`、`.sisyphus`、`temp_navbar.txt`、`temp_sidebar.txt` 共 68 个相关 artifact。
- `.codex/skills/ui-ux-pro-max/scripts/__pycache__/*.pyc` 是明显生成物。
- `src/app/__visual-admin`、`src/app/visual-admin` 当前目录存在但无跟踪文件。

影响：

- 仓库噪音影响代码审查。
- 但 `.codex` / `.opencode` / `.sisyphus` 可能是项目工作流资产，不能未经确认整体删除。

处理：

- 明确“保留、归档、删除”三类。
- 先删临时文件和 pycache；工具目录另开提交和说明。

## 非目标

- 不进行全站 UI 重设计。
- 不在 cleanup 阶段引入新依赖。
- 不一次性升级 Auth/Next/React/Prisma。
- 不把历史计划文档、工具目录和业务代码混在同一个提交。
- 不用大规模格式化掩盖真实 diff。

## 执行计划

### Phase 0：修复行为锁与验证基线

目标：让后续重构有可信验证闭环。

任务：

- 修复或更新 `e2e/admin.spec.ts`，使其匹配当前登录弹窗 URL 契约：`/?login=1&callbackUrl=%2Fadmin`。
- 修复或更新 `e2e/author.spec.ts`，确认 `/write` 当前预期 UI；如果该页面已改为静态/未登录态，测试应表达真实契约。
- 修复或更新 `e2e/reader.spec.ts`，确认 `/posts` 当前标题或主要内容契约。
- 处理 `quality={72}` 与 `images.qualities` 不一致。
- 如继续使用 `127.0.0.1` dev server，评估是否需要在 `next.config.ts` 加 `allowedDevOrigins`。

优先文件：

- `e2e/admin.spec.ts`
- `e2e/author.spec.ts`
- `e2e/reader.spec.ts`
- `next.config.ts`
- `src/components/blog/HomeLatestPosts.tsx`
- `src/components/blog/PostCard.tsx`
- `src/__tests__/next-config-images.test.ts`

验收：

- `pnpm test:e2e` 通过，或每个失败都有明确产品决策和修复任务。
- Next Image quality 警告消失。
- 基础验证仍通过。

### Phase 1：生产安全与认证边界专项

目标：先处理安全/部署误用风险。

任务：

- 移除 Docker build 阶段 secret args：`DATABASE_URL`、`AUTH_SECRET`、`NEXTAUTH_SECRET`。
- 保留运行时 secret，仅通过 runtime env / `env_file` 注入。
- 为 Dockerfile/compose 增加 contract test，禁止 secret build args 回归。
- 收敛 `/api/auth/login`：删除、返回 410，或明确改为非 session 验证端点并更新命名/文档。
- 保留 `src/lib/__tests__/auth-routes.test.ts` 对 signout ownership 的保护。
- 为 Auth adapter 兼容性创建 ADR：继续 v4 + 当前 adapter 强转、迁移到适配 v4 的 adapter、或整体升级 Auth.js，三选一。

验收：

- Docker build 不接收 secret build args。
- 不存在“返回 success 但未创建 session”的登录误导路径。
- 认证相关测试通过。

### Phase 2：API 路由边界统一

目标：减少 route handler 重复解析、重复响应、局部鉴权。

任务：

- 抽 `parseIdList(searchParams)`，替换后台 `categories/tags/posts/comments` 的重复 `parseIds`。
- 统一空 id 错误为 `ValidationError` 或稳定错误响应。
- 复用 `isPrismaConflictError`，删除局部 `isConflict`。
- 将公开 `categories/tags` 写操作纳入统一鉴权和输入解析；公开路由中存在延迟加载 `requireAdmin`（动态 import auth 以防公共 GET 因 auth 配置崩溃），若保留此模式须写明原因并封成 helper。
- 对裸 `request.json()` 路径使用已有 parse 函数或新建窄 parser。
- 将 11 个仍用裸 `NextResponse.json` 的路由文件纳入统一错误响应（排除 NextAuth catch-all 路由）：`account/github/unlink`、`admin/set-admin`、`admin/uploads/qiniu-token`、`ai/openapi`、`analytics/visit`、`auth/session`、`categories`、`posts/[slug]/bookmark`、`search`、`tags`。

优先文件：

- `src/lib/validation.ts`
- `src/lib/api-errors.ts`
- `src/app/api/admin/categories/route.ts`
- `src/app/api/admin/tags/route.ts`
- `src/app/api/admin/posts/route.ts`
- `src/app/api/admin/comments/route.ts`
- `src/app/api/categories/route.ts`
- `src/app/api/tags/route.ts`

验收：

- 重复 `parseIds` 消失。
- route tests 覆盖空 id、未授权、冲突、成功路径。
- API 响应契约不破坏前端。

### Phase 3：后台客户端请求 helper

目标：统一后台客户端 fetch、错误读取和 toast 输入。

任务：

- 新增轻量 helper，例如 `src/components/admin/api.ts`。
- 提供 `readApiJson(response, fallback)` 和可选 `requestApi(path, init, fallback)`。
- 保持现有 toast 文案，不先统一成一套新文案系统。
- 先迁移 posts/comments/taxonomy，再迁移 AI/covers/settings。

第一批（posts/comments/taxonomy/ai-news，优先）：

- `src/app/admin/posts/page.tsx`
- `src/app/admin/comments/page.tsx`
- `src/components/admin/taxonomy/TaxonomyStudio.tsx`
- `src/app/admin/ai-news/page.tsx`

第二批（AI/covers/settings/notifications）：

- `src/components/admin/ai/AiModelManager.tsx`
- `src/components/admin/ai/AiTaskDetail.tsx`
- `src/components/admin/ai/BulkAiCompletionDialog.tsx`
- `src/components/admin/ai/PostAiWorkspace.tsx`
- `src/components/admin/covers/AiCoverGenerator.tsx`
- `src/components/admin/covers/CoverAssetForm.tsx`
- `src/components/admin/covers/CoverGalleryManager.tsx`
- `src/components/admin/covers/CoverPicker.tsx`
- `src/components/admin/notifications/NotificationBell.tsx`
- `src/components/admin/notifications/NotificationCenterClient.tsx`
- `src/components/admin/settings/AdminSettingsClient.tsx`
- `src/components/admin/settings/GitHubBinding.tsx`

验收：

- 16 处局部错误 helper 明显减少。
- 相关组件测试通过。
- 不引入新状态库。

### Phase 4：后台编辑与管理大组件拆分

目标：降低本地状态耦合，不改变页面结构。

任务：

- 从 `AdminPostWorkspace` 抽表单初始化、slug 派生、保存请求、封面上传、AI 元数据动作。
- 从 `TaxonomyStudio` 抽分类/标签共享列表动作和删除预览动作。
- 从 `AiModelManager` 抽 API 操作和表单状态 reducer/helper。

验收：

- 每个大组件至少拆出 1 到 3 个有测试或纯函数边界的模块。
- 创建、编辑、发布、AI 填充、封面、分类标签页面测试通过。

### Phase 5：AI 领域模块拆分

目标：保留 facade，迁移内部职责。

任务：

- `ai-news.ts` 保留对外入口，拆出 parser、candidate flow、draft flow、run flow。
- `ai-models.ts` 拆出 encryption/config、repository、public mapper、connection test。
- `ai-post-actions.ts` 拆出 prompt/output parsing 与 task apply 逻辑。

验收：

- 对外 import 不大范围变动。
- AI 相关测试通过。
- 无新增全局状态和新依赖。

### Phase 6：UI primitive 收敛

目标：建立单一设计 primitive 来源。

任务：

- 决定 canonical primitive 层。建议优先基于 `src/components/admin/ui` 的 CVA/asChild 能力。
- 将公共 `Button/Card/Input/Modal` 改为薄 wrapper 或 re-export。
- 删除 `src/components/posts/PostList.tsx`：已确认该组件仅在 `src/components/posts/index.ts` barrel export 中出现，全项目无真实运行时调用入口。应同步删除 barrel export 条目及相关测试契约。

验收：

- Button/Card 变体定义不再双写。
- 公共和后台相关 UI 测试通过。
- 无大规模视觉重设计。

### Phase 7：配置、依赖与运行时契约清理

目标：清理配置债务，避免误删仍在用的依赖。

任务：

- 评估 `tsconfig.target` 从 `ES2017` 提升的影响。
- 评估是否能关闭 `allowJs`；若 scripts 仍为 CJS，可保留并写明原因。
- 评估 `skipLibCheck` 是否能收紧；如果第三方类型阻塞，记录原因。
- 保留 `dotenv`，除非 Prisma config 和 scripts 都有替代方案。
- 为 `dangerouslyAllowLocalIP` 写清用途，或拆成环境化配置。
- 检查 `prisma` 是否必须在 production dependencies 中保留；当前 Docker runner 执行 `pnpm prisma generate`，不能简单移动到 devDependencies。

验收：

- 每个配置变更都有测试或构建证明。
- 不出现“看似冗余但实际被 Prisma/scripts 使用”的误删。

### Phase 8：仓库卫生

目标：降低仓库噪音，保留必要工作流资产。

任务：

- 删除 `temp_navbar.txt`、`temp_sidebar.txt`。
- 删除 `.codex/skills/ui-ux-pro-max/scripts/__pycache__/*.pyc`。
- `.gitignore` 补充 `__pycache__/`、`*.pyc`。
- 删除 `src/app/__visual-admin/` 和 `src/app/visual-admin/` 两个空目录（已确认为纯空目录，无任何文件，非进行中工作）；若有本地未跟踪文件，先确认再删除。
- 对 `.codex`、`.opencode`、`.sisyphus` 做分类说明：保留、迁移到 docs、或移出源码仓库。
- 历史计划文档只做归档策略，不和业务代码同提交。

验收：

- 生成物不再被跟踪。
- 工具目录去留有说明。
- 仓库卫生提交不包含源码行为改动。

## 推荐顺序

1. Phase 0：修复 e2e 与 Next Image quality 契约。
2. Phase 1：Docker secret build args 与 `/api/auth/login` 边界。
3. Phase 2：API route helper 和错误/鉴权统一。
4. Phase 3：后台 fetch helper。
5. Phase 8：低风险仓库卫生单独提交。
6. Phase 4：后台编辑与管理大组件拆分。
7. Phase 5：AI 领域模块拆分。
8. Phase 6：UI primitive 收敛。
9. Phase 7：配置和依赖收紧。

## 验证矩阵

基础门槛：

```bash
pnpm lint
pnpm exec tsc --noEmit --incremental false --pretty false
pnpm test
pnpm build
```

端到端门槛：

```bash
pnpm test:e2e
```

重点局部测试建议：

```bash
pnpm exec vitest run src/__tests__/next-config-images.test.ts src/__tests__/middleware.test.ts
pnpm exec vitest run src/lib/__tests__/validation.test.ts src/lib/__tests__/api-errors.test.ts src/lib/__tests__/auth-routes.test.ts
pnpm exec vitest run src/app/api/admin/categories/__tests__/route.test.ts src/app/api/admin/posts/__tests__/route.test.ts
pnpm exec vitest run src/app/admin/__tests__/admin-editor.test.tsx src/app/admin/__tests__/admin-create-post.test.tsx
pnpm exec vitest run src/lib/__tests__/ai-news.test.ts src/lib/__tests__/ai-models.test.ts src/lib/__tests__/ai-post-actions.test.ts
```

## 需要决策的问题

- `/api/auth/login` 是删除还是 410？（已确认无前端调用方，删除风险极低）
- Auth adapter 是继续当前强转方案并补运行级测试，还是规划 Auth.js 升级？
- `.codex`、`.opencode`、`.sisyphus` 是否属于项目交付资产？
- 公开注册是否保留？若保留，是否需要邮箱验证或邀请码策略？（当前有速率限制但无邀请码）
- `images.dangerouslyAllowLocalIP` 是本地/内网部署需要，还是历史遗留？
- AI 模型 API key 加密密钥源：是否应引入独立 `AI_MODEL_SECRET_KEY`，与 `AUTH_SECRET` 解耦，以支持 auth secret 独立轮换？
- "Lore Commit Protocol" 是否有外部定义文档？若无，需在本计划或 `docs/` 下补充提交格式规范，否则"每个提交按协议记录约束、测试证据和未验证项"无法统一执行。

## 完成定义

本轮重构完成时应满足：

- e2e 基线恢复可用。
- Docker build 不接收 secret。
- API route 的 id 解析、鉴权、错误响应明显收敛。
- 后台客户端 fetch 错误处理不再重复散落。
- 高复杂度文件被拆出稳定边界，对外 API 保持兼容。
- UI primitive 有单一来源或清晰 wrapper 策略。
- 临时文件和生成物不再被跟踪。
- lint、typecheck、unit tests、build、e2e 均通过。
- 每个提交记录约束、测试证据和未验证项（若 Lore Commit Protocol 已有外部定义，按其格式；否则先在 `docs/` 补充格式规范再执行）。
