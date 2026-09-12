# 重构详细执行任务计划

> 基于：`2026-05-09-project-refactor-cleanup-plan.md`
> 生成日期：2026-05-09
> 执行顺序：Phase 0 → 1 → 2 → 3 → 8 → 4 → 5 → 6 → 7
> 总原子任务：68 个 | 估计总工时：15.5 小时

---

## 执行摘要

| Phase | 任务数 | 预计工时 | 可并行任务 | 关键路径 |
|-------|--------|----------|-----------|----------|
| 0 | 6 | 1h | 0.1/0.2/0.3 并行；0.4/0.5 并行 | 0.6 依赖 0.4/0.5 |
| 1 | 7 | 2h | 1.4 独立；1.1→1.2→1.3 顺序；1.6/1.7 独立 | 1.1→1.2→1.3 |
| 2 | 15 | 2h | 2.1 先行；2.2–2.5 并行；2.6–2.14 并行 | 2.1 是瓶颈 |
| 3 | 18 | 2h | 3.1 先行；3.2–3.5 并行；3.6–3.17 并行 | 3.1 是瓶颈 |
| 8 | 5 | 0.5h | 全部并行 | 无 |
| 4 | 8 | 4h | 4.1 先行；4.2/4.3/4.4 并行；4.5/4.7 独立 | 4.1→4.2/4.3/4.4 |
| 5 | 5 | 3h | 5.1 独立；5.2→5.3→5.4 顺序；5.5 独立 | 5.2→5.3→5.4 |
| 6 | 2 | 0.5h | 6.1/6.2 并行 | 无 |
| 7 | 2 | 0.5h | 7.1/7.2 并行 | 无 |

---

## Phase 0：修复 e2e 与 Image quality 契约

**目标：** 让 3 个 Playwright 测试全部通过，锁定 quality 契约。

**根因（已验证）：**
- `admin.spec.ts`：断言 URL 匹配 `/\/(login|$)/`，实际是 `/?login=1&callbackUrl=%2Fadmin`（登录弹窗模式）
- `author.spec.ts`：`/write` 实际 redirect 到 `/admin/posts/new`，middleware 鉴权失败再跳首页，找不到"创作工作台"
- `reader.spec.ts`：`/posts` 的 h1 是"全部文章"，不是"内容探索"
- `HomeLatestPosts.tsx:74` 和 `PostCard.tsx:60` 用 `quality={72}`，但 `next.config.ts` 的 `images.qualities` 只有 `[70, 75]`

### 任务 0.1 — 修正 admin e2e URL 断言

- **文件：** `e2e/admin.spec.ts`
- **操作：** 将断言从 `/\/(login|$)/` 改为 `/[?&]login=1/`
- **理由：** `buildLoginPromptPath` 固定返回 `/?login=1&callbackUrl=...`，该正则精确匹配 query 参数
- **验证：** `pnpm test:e2e --grep "admin"`

### 任务 0.2 — 修正 author e2e 测试目标与断言

- **文件：** `e2e/author.spec.ts`
- **操作：** 将测试改为断言未认证用户访问 `/write` 被重定向（`toHaveURL(/[?&]login=1/)`)，不再断言 UI 内容
- **理由：** `/write` → redirect(`/admin/posts/new`) → middleware 鉴权失败 → `/?login=1&callbackUrl=%2Fadmin%2Fposts%2Fnew`，此行为无需登录可稳定断言
- **验证：** `pnpm test:e2e --grep "author"`

### 任务 0.3 — 修正 reader e2e 标题断言

- **文件：** `e2e/reader.spec.ts`
- **操作：** 将 `getByRole('heading', { name: '内容探索' })` 改为 `getByRole('heading', { name: '全部文章' })`
- **理由：** `/posts` 页面（`src/app/(public)/posts/page.tsx`）的实际 h1 是"全部文章"
- **验证：** `pnpm test:e2e --grep "reader"`

### 任务 0.4 — 修复 HomeLatestPosts.tsx 的 quality 值

- **文件：** `src/components/blog/HomeLatestPosts.tsx`
- **操作：** 将第 74 行 `quality={72}` 改为 `quality={70}`
- **并行：** 与 0.5 并行
- **验证：** `pnpm tsc --noEmit`

### 任务 0.5 — 修复 PostCard.tsx 的 quality 值

- **文件：** `src/components/blog/PostCard.tsx`
- **操作：** 将第 60 行 `quality={72}` 改为 `quality={70}`
- **并行：** 与 0.4 并行
- **验证：** `pnpm tsc --noEmit`

### 任务 0.6 — 在测试中锁定 quality 契约

- **文件：** `src/__tests__/next-config-images.test.ts`
- **操作：** 追加测试用例：`expect(nextConfig.images?.qualities).toEqual([70, 75])`
- **前置：** 0.4、0.5 完成
- **验证：** `pnpm test src/__tests__/next-config-images.test.ts`

### Phase 0 门控

```bash
pnpm test:e2e
pnpm test src/__tests__/next-config-images.test.ts
pnpm tsc --noEmit
```

---

## Phase 1：生产安全与认证边界

**目标：** 消除镜像层 secret 泄漏、删除孤立自定义登录端点、移除类型强转。

### 任务 1.1 — 从 Dockerfile builder 阶段移除 secret ARG

- **文件：** `Dockerfile`
- **操作：**
  - 删除 `ARG DATABASE_URL`、`ARG AUTH_SECRET`、`ARG NEXTAUTH_SECRET` 三行
  - 保留 `ARG NEXTAUTH_URL`、`ARG NEXT_PUBLIC_SITE_URL`（非敏感 URL）
  - 在 `RUN pnpm build` 前缀中删除 `DATABASE_URL="$DATABASE_URL" AUTH_SECRET="$AUTH_SECRET" NEXTAUTH_SECRET="$NEXTAUTH_SECRET"`
  - 结果：`RUN NEXTAUTH_URL="$NEXTAUTH_URL" NEXT_PUBLIC_SITE_URL="$NEXT_PUBLIC_SITE_URL" pnpm build`
- **注意：** 若 build 失败（有代码在构建时读取这些变量），检查 `next.config.ts` 和 `layout.tsx`
- **验证：** `docker build --no-cache -t test-build .`（不传 DATABASE_URL/AUTH_SECRET/NEXTAUTH_SECRET）

### 任务 1.2 — 从 docker-compose.prod.yml 移除 secret build args

- **文件：** `docker-compose.prod.yml`
- **操作：** 删除 `build.args` 中的 `DATABASE_URL`、`AUTH_SECRET`、`NEXTAUTH_SECRET` 三行，保留 `NEXTAUTH_URL`、`NEXT_PUBLIC_SITE_URL`
- **前置：** 1.1 完成
- **验证：** `docker compose -f docker-compose.prod.yml config`

### 任务 1.3 — 扩展 dockerfile-proxy-guard 测试

- **文件：** `src/lib/__tests__/dockerfile-proxy-guard.test.ts`
- **操作：** 追加三个测试，断言 Dockerfile 中不包含 `^ARG DATABASE_URL$`、`^ARG AUTH_SECRET$`、`^ARG NEXTAUTH_SECRET$`（多行正则）
- **前置：** 1.1 完成
- **验证：** `pnpm test src/lib/__tests__/dockerfile-proxy-guard.test.ts`

### 任务 1.4 — 删除孤立登录 API 端点

- **文件：** `src/app/api/auth/login/route.ts`
- **操作：** 直接删除文件（已确认无任何前端代码调用此路由）
- **并行：** 与 1.1–1.3 独立，可并行
- **验证：** `pnpm tsc --noEmit && pnpm test src/lib/__tests__/auth-routes.test.ts`

### 任务 1.5 — 在 auth-routes 测试中断言登录端点不存在

- **文件：** `src/lib/__tests__/auth-routes.test.ts`
- **操作：** 追加测试：`expect(existsSync('src/app/api/auth/login/route.ts')).toBe(false)`
- **前置：** 1.4 完成
- **验证：** `pnpm test src/lib/__tests__/auth-routes.test.ts`

### 任务 1.6 — 清理 auth.ts 中的跨版本类型强转

- **文件：** `src/lib/auth.ts`
- **操作：**
  - 删除顶部 `import type { Adapter } from "next-auth/adapters"`
  - 将 `adapter: PrismaAdapter(prisma) as Adapter` 改为内联类型写法：`adapter: PrismaAdapter(prisma) as import("next-auth/adapters").Adapter`
  - 这明确标注跨版本适配点，等价于原有强转但去掉了顶部 import
- **并行：** 与 1.4 并行
- **验证：** `pnpm tsc --noEmit`

### 任务 1.7 — 为 AI Model 加密密钥添加轮换风险注释

- **文件：** `src/lib/ai-models.ts`
- **操作：** 在 `getApiKeyEncryptionKey()` 函数前追加 JSDoc 注释，说明密钥优先级（AI_MODEL_SECRET_KEY → AUTH_SECRET → NEXTAUTH_SECRET）和 auth secret 轮换会导致已存储 AI API key 无法解密的风险
- **并行：** 与其他任务独立
- **验证：** `pnpm tsc --noEmit`

### Phase 1 门控

```bash
pnpm lint
pnpm tsc --noEmit
pnpm test
pnpm test:e2e
```

---

## Phase 2：API 路由边界统一

**目标：** 消除 4 处重复 `parseIds`；11 个路由改用 `toErrorResponse`。

**依赖关系：** 任务 2.1 必须先完成，2.2–2.5 依赖它并可并行，2.6–2.14 独立可并行。

### 任务 2.1 — 在 validation.ts 中导出 parseIdList

- **文件：** `src/lib/validation.ts`
- **操作：** 在文件末尾追加导出函数：
  ```typescript
  export function parseIdList(searchParams: URLSearchParams): string[] {
    return (searchParams.get("ids") ?? searchParams.getAll("id").join(","))
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
  }
  ```
- **验证：** `pnpm tsc --noEmit`

### 任务 2.2 — admin/categories/route.ts 改用 parseIdList

- **文件：** `src/app/api/admin/categories/route.ts`
- **操作：** 在 import 行添加 `parseIdList`；删除第 8–13 行本地 `parseIds` 函数；将调用改为 `parseIdList`
- **前置：** 2.1 完成

### 任务 2.3 — admin/tags/route.ts 改用 parseIdList

- **文件：** `src/app/api/admin/tags/route.ts`
- **操作：** 同 2.2
- **前置：** 2.1 完成；与 2.2 并行

### 任务 2.4 — admin/posts/route.ts 改用 parseIdList

- **文件：** `src/app/api/admin/posts/route.ts`
- **操作：** 同 2.2
- **前置：** 2.1 完成；与 2.2/2.3 并行

### 任务 2.5 — admin/comments/route.ts 改用 parseIdList

- **文件：** `src/app/api/admin/comments/route.ts`
- **操作：** 同 2.2
- **前置：** 2.1 完成；与 2.2/2.3/2.4 并行

### 任务 2.6–2.14 — 11 个路由改用 toErrorResponse

对以下每个文件：追加 `import { toErrorResponse } from "@/lib/api-errors"`，将 catch 块中 `console.error + NextResponse.json` 替换为 `return toErrorResponse(error)`：

- **2.6** `src/app/api/categories/route.ts`（GET 和 POST 的 catch）
- **2.7** `src/app/api/tags/route.ts`（GET 和 POST 的 catch）
- **2.8** `src/app/api/account/github/unlink/route.ts`（POST 函数体包裹 try/catch）
- **2.9** `src/app/api/admin/uploads/qiniu-token/route.ts`（catch 从 `if(error instanceof ApiError)...` 替换为 `return toErrorResponse(error)`；调用方检查 `!response.ok` 而非 `success` 字段，安全）
- **2.10** `src/app/api/analytics/visit/route.ts`（POST 数据库操作包裹 try/catch）
- **2.11** `src/app/api/auth/session/route.ts`（catch 从 `return NextResponse.json({ user: null })` 改为 `return toErrorResponse(error)`）
- **2.12** `src/app/api/posts/[slug]/bookmark/route.ts`（POST 和 GET 的 catch）
- **2.13** `src/app/api/search/route.ts`（最外层 catch）
- **2.14** `src/app/api/ai/openapi/route.ts`（整体包裹 try/catch）

**注意（2.11）：** session 接口出错时从 `{ user: null }` 变为 5xx 错误响应，确认调用方 `src/lib/auth-client.ts` 对非 200 响应处理正确（应当按"未登录"处理）。

### 任务 2.15 — 为 parseIdList 新增单元测试

- **文件：** `src/lib/__tests__/validation.test.ts`
- **操作：** 追加 5 个测试用例：`ids=a,b,c` 解析、`id=a&id=b` 解析、`ids` 优先于 `id`、trim 和过滤空字符串、无参数返回空数组
- **前置：** 2.1 完成
- **验证：** `pnpm test src/lib/__tests__/validation.test.ts`

### Phase 2 门控

```bash
pnpm lint
pnpm tsc --noEmit
pnpm test
```

---

## Phase 3：后台客户端 fetch helper

**目标：** 16 个后台文件消除重复的 `response.ok + data.success + data.error` 处理模式。

**依赖关系：** 任务 3.1 必须先完成，其余可并行。

### 任务 3.1 — 新建 src/lib/admin-api-client.ts

- **文件：** `src/lib/admin-api-client.ts`（新建）
- **导出内容：**
  1. `getApiErrorMessage(data: unknown, fallback: string): string`
     - 若 data 是对象且有非空字符串 `error` 字段，返回该值；否则返回 fallback
  2. `readApiJson<T>(response: Response, fallback?: string): Promise<T>`
     - `await response.json().catch(() => ({}))`
     - 若 `!response.ok || data.success === false`，throw new Error（优先用 `data.error`，否则用 `fallback ?? "请求失败"`）
     - 返回 data
  3. `requestApi(path: string, init?: RequestInit): Promise<Response>`
     - 封装 fetch，统一后台请求入口
- **验证：** `pnpm tsc --noEmit`

### 任务 3.2–3.5（第一批，并行）— 改用 getApiErrorMessage

- **3.2** `src/app/admin/posts/page.tsx`：删除本地 `getErrorMessage`，import 并使用 `getApiErrorMessage`
- **3.3** `src/app/admin/comments/page.tsx`：同上
- **3.4** `src/components/admin/taxonomy/TaxonomyStudio.tsx`：删除第 19–28 行本地函数，替换
- **3.5** `src/app/admin/ai-news/page.tsx`：删除本地 `readError`（功能相同但名称不同），改为 `getApiErrorMessage(data, "AI 日报生成失败")`

### 任务 3.6–3.10（第二批，并行）— 改用 readApiJson 或 getApiErrorMessage

- **3.6** `src/components/admin/ai/AiModelManager.tsx`：删除本地 `readJson`，改用 `readApiJson`
- **3.7** `src/components/admin/ai/AiTaskDetail.tsx`：将 `throw new Error(data.error || "...")` 改为 `throw new Error(getApiErrorMessage(data, "..."))`
- **3.8** `src/components/admin/ai/BulkAiCompletionDialog.tsx`：删除本地 `getErrorMessage`，替换
- **3.9** `src/components/admin/ai/PostAiWorkspace.tsx`：将内联 `data.error ||` 模式改为 `getApiErrorMessage`
- **3.10** `src/components/admin/covers/AiCoverGenerator.tsx`：删除本地 `readJson`，改用 `readApiJson`

### 任务 3.11–3.17（第二批续，并行）— 批量处理

- **3.11** `src/components/admin/covers/CoverAssetForm.tsx`
- **3.12** `src/components/admin/covers/CoverGalleryManager.tsx`（本地 `getError` 函数）
- **3.13** `src/components/admin/covers/CoverPicker.tsx`
- **3.14** `src/components/admin/notifications/NotificationBell.tsx`（检查 `!payload?.success`，用 `readApiJson` 处理）
- **3.15** `src/components/admin/notifications/NotificationCenterClient.tsx`（同 3.14）
- **3.16** `src/components/admin/settings/AdminSettingsClient.tsx`（有本地 `getErrorMessage`）
- **3.17** `src/components/admin/settings/GitHubBinding.tsx`（内联 `data.error ||` 模式）

### 任务 3.18 — 为 admin-api-client.ts 新增单元测试

- **文件：** `src/lib/__tests__/admin-api-client.test.ts`（新建）
- **操作：** 测试 `getApiErrorMessage` 的三种情况（有 error、无 error、error 为空字符串）；测试 `readApiJson` 的成功/失败/throw 消息三种情况；使用 `new Response(...)` 构造 mock
- **验证：** `pnpm test src/lib/__tests__/admin-api-client.test.ts`

### Phase 3 门控

```bash
pnpm lint
pnpm tsc --noEmit
pnpm test
```

---

## Phase 8：仓库卫生

**目标：** 清理临时文件、编译缓存、空目录，完善 `.gitignore`。所有任务可并行。

### 任务 8.1 — 删除 temp_navbar.txt

- **文件：** `temp_navbar.txt`（删除）
- **验证：** `git status`

### 任务 8.2 — 删除 temp_sidebar.txt

- **文件：** `temp_sidebar.txt`（删除）
- **验证：** `git status`

### 任务 8.3 — 删除 Python 编译缓存

- **路径：** `.codex/skills/ui-ux-pro-max/scripts/__pycache__/`（删除目录及 3 个 .pyc 文件）
- **验证：** `git status`

### 任务 8.4 — 补充 .gitignore 规则

- **文件：** `.gitignore`
- **操作：** 在 `# misc` 部分末尾追加：
  ```
  # Python
  __pycache__/
  *.pyc
  *.pyo
  ```
- **验证：** `git check-ignore -v .codex/skills/ui-ux-pro-max/scripts/__pycache__/`（应显示被忽略）

### 任务 8.5 — 删除空 visual-admin 目录

- **路径：** `src/app/__visual-admin/` 和 `src/app/visual-admin/`（已确认为空目录）
- **操作：** 删除前先 `ls` 确认为空，再删除
- **验证：** `pnpm build`

### Phase 8 门控

```bash
pnpm build
pnpm test
```

---

## Phase 4：大组件拆分

**目标：** 将 3 个大组件（781/488/544 行）拆出 hooks，降低单文件复杂度。

**原则：** 每次只迁移一种职责；每个 hook 提取后立即运行测试套件。

### 任务 4.1 — 从 AdminPostWorkspace 拆出 usePostForm hook

- **新建：** `src/components/posts/hooks/usePostForm.ts`
- **编辑：** `src/components/posts/AdminPostWorkspace.tsx`
- **移入内容：** `formData` state、`emptyFormData` 常量、`normalizeDraft` 函数、`canSubmit` useMemo、localStorage 草稿读写的 useEffect
- **hook 签名：** `usePostForm(mode: "create" | "edit", draftKey: string | null)`，返回 `{ formData, setFormData, canSubmit }`
- **验证：** `pnpm test src/components/posts && pnpm tsc --noEmit`

### 任务 4.2 — 从 AdminPostWorkspace 拆出 useSlugDerive hook

- **新建：** `src/components/posts/hooks/useSlugDerive.ts`
- **移入内容：** `isSlugManuallyEdited` state 及随 title 自动更新 slug 的 useEffect
- **hook 签名：** `useSlugDerive(title: string, slug: string, setField: (slug: string) => void)`，返回 `{ isSlugManuallyEdited, setIsSlugManuallyEdited }`
- **前置：** 4.1 完成
- **验证：** `pnpm tsc --noEmit && pnpm test`

### 任务 4.3 — 从 AdminPostWorkspace 拆出 useCoverUpload hook

- **新建：** `src/components/posts/hooks/useCoverUpload.ts`
- **移入内容：** `isCoverUploading`、`coverUploadError`、`coverFileInputRef`、文件选择和七牛上传事件处理函数
- **hook 签名：** `useCoverUpload(onUploadSuccess: (url: string) => void)`，返回 `{ isCoverUploading, coverUploadError, coverFileInputRef, handleCoverFileChange }`
- **前置：** 4.1 完成；与 4.2 并行
- **验证：** `pnpm tsc --noEmit`

### 任务 4.4 — 从 AdminPostWorkspace 拆出 useAiActions hook

- **新建：** `src/components/posts/hooks/useAiActions.ts`
- **移入内容：** `isSummarizing`、`summaryError`、`metadataPendingField`、`metadataError`、`isCompletingMetadata`、`handleGenerateSummary`、`handleCompleteMetadata`
- **hook 签名：** `useAiActions(postId: string | undefined, formData: FormData)`，返回所有 AI 状态和触发函数
- **前置：** 4.1 完成；与 4.2/4.3 并行
- **验证：** `pnpm tsc --noEmit && pnpm test`

### 任务 4.5 — 从 TaxonomyStudio 拆出 useTaxonomyActions hook

- **新建：** `src/components/admin/taxonomy/hooks/useTaxonomyActions.ts`
- **移入内容：** 分类/标签 CRUD 操作的 async 函数和 loading/error 状态
- **hook 签名：** `useTaxonomyActions(activeTab: "categories" | "tags")`，返回 `{ items, loading, error, create, update, remove, refresh }`
- **并行：** 与 4.1–4.4 独立
- **验证：** `pnpm tsc --noEmit && pnpm test`

### 任务 4.6 — 从 TaxonomyStudio 拆出 DeletePreviewDialog 组件

- **新建：** `src/components/admin/taxonomy/DeletePreviewDialog.tsx`
- **操作：** 将删除确认弹窗 JSX 提取为独立组件，接收 `open`、`impacts`、`onConfirm`、`onCancel` props
- **前置：** 4.5 完成
- **验证：** `pnpm tsc --noEmit`

### 任务 4.7 — 从 AiModelManager 拆出 useModelForm hook

- **新建：** `src/components/admin/ai/hooks/useModelForm.ts`
- **移入内容：** `FormState`、`emptyForm`、`form` state、`formFromModel` 函数、字段 change handlers
- **返回：** `{ form, setForm, resetForm, formFromModel }`
- **并行：** 与 4.1–4.6 独立
- **验证：** `pnpm tsc --noEmit`

### 任务 4.8 — 从 AiModelManager 拆出 useModelActions hook

- **新建：** `src/components/admin/ai/hooks/useModelActions.ts`
- **移入内容：** `handleCreate`、`handleUpdate`、`handleDelete`、`handleTest`、`handleSetDefault`，以及 `testingId`、`switchingId`、`loading` 等状态
- **hook 签名：** `useModelActions(onModelsChange: () => void)`，返回所有操作函数和状态
- **前置：** 4.7 完成
- **验证：** `pnpm tsc --noEmit && pnpm test`

### Phase 4 门控

```bash
pnpm lint
pnpm tsc --noEmit
pnpm test
pnpm build
```

---

## Phase 5：AI 领域模块拆分

**目标：** 将 3 个大 AI 模块拆分为职责单一的子模块，`ai-models.ts` 中的加密逻辑与 auth secret 解耦。

### 任务 5.1 — 从 ai-models.ts 拆出 ai-models-crypto.ts

- **新建：** `src/lib/ai-models-crypto.ts`
- **移入内容：**
  - `ENCRYPTED_API_KEY_PREFIX` 常量
  - `getApiKeyEncryptionKey()` 私有函数
  - `encryptApiKeyForStorage(apiKey)` 函数（导出）
  - `decryptApiKeyFromStorage(apiKey)` 函数（导出）
  - `node:crypto` import
- **编辑：** `src/lib/ai-models.ts` 删除上述内容，改为从 `"@/lib/ai-models-crypto"` import
- **核心价值：** 将 auth secret 依赖隔离，支持独立测试和未来密钥轮换
- **并行：** 与 5.2 独立
- **验证：** `pnpm test src/lib/__tests__/ai-models.test.ts && pnpm tsc --noEmit`

### 任务 5.2 — 从 ai-news.ts 拆出 ai-news-parser.ts

- **新建：** `src/lib/ai-news-parser.ts`
- **移入内容：** `parseNewsFeed()`、`dedupeNewsItems()`、`buildDailyAiNewsSlug()` 及相关纯类型定义（不依赖数据库的静态解析逻辑）
- **编辑：** `src/lib/ai-news.ts` 改为从新文件 re-export（保持向后兼容）
- **验证：** `pnpm test src/lib/__tests__/ai-news.test.ts && pnpm tsc --noEmit`

### 任务 5.3 — 从 ai-news.ts 拆出 ai-news-draft-flow.ts

- **新建：** `src/lib/ai-news-draft-flow.ts`
- **移入内容：** `generateDailyAiNewsDraft()` 函数（第 799 行，约 80 行）及其直接依赖的私有辅助函数
- **前置：** 5.2 完成（类型稳定）
- **验证：** `pnpm test src/lib/__tests__/ai-news.test.ts && pnpm tsc --noEmit`

### 任务 5.4 — 从 ai-news.ts 拆出 ai-news-run-flow.ts（facade 保留）

- **新建：** `src/lib/ai-news-run-flow.ts`
- **移入内容：** `fetchDailyAiNewsCandidates()`（第 640 行）和 `runDailyAiNews()`（第 886 行）
- **编辑：** `src/lib/ai-news.ts` 改为纯 facade：只包含从三个子文件的 re-export，维持所有现有调用者 import 不变
- **前置：** 5.2、5.3 完成
- **验证：** `pnpm test src/lib/__tests__/ai-news.test.ts && pnpm tsc --noEmit`

### 任务 5.5 — 从 ai-post-actions.ts 拆出 prompt/output parsing

- **新建：** `src/lib/ai-post-actions-prompts.ts`
- **移入内容：** prompt 构建函数和 AI 输出解析函数（无副作用、不依赖数据库的纯函数）
- **编辑：** `src/lib/ai-post-actions.ts` 保留数据库读写和副作用逻辑，从新文件 import
- **并行：** 与 5.1–5.4 独立
- **验证：** `pnpm test src/lib/__tests__/ai-post-actions.test.ts && pnpm tsc --noEmit`

### Phase 5 门控

```bash
pnpm lint
pnpm tsc --noEmit
pnpm test
pnpm build
```

---

## Phase 6：UI primitive 收敛

**目标：** 统一 Button 组件实现，删除 PostList 冗余组件。

### 任务 6.1 — 将 src/components/ui/Button.tsx 改为 admin Button 的薄包装

- **文件：** `src/components/ui/Button.tsx`
- **操作：**
  - 删除所有实现代码（`baseStyles`、`variants`、`sizes` 等）
  - 改为 re-export：`export { Button } from "@/components/admin/ui/button"`；`export type { ButtonProps } from "@/components/admin/ui/button"`
- **兼容性确认：** 现有调用方只用了 primary/secondary/outline/ghost/danger variant 和 sm/md/lg size，admin 版完全兼容；asChild 额外 prop 默认为 false 不影响现有调用
- **验证：** `pnpm tsc --noEmit && pnpm test`

### 任务 6.2 — 删除 PostList.tsx

- **文件：** `src/components/posts/PostList.tsx`（删除）
- **前置操作：**
  1. 先编辑 `src/components/posts/index.ts`，删除 `export { PostList }` 和 `export type { PostListProps }` 两行
  2. 再删除 `src/components/posts/PostList.tsx`
- **并行：** 与 6.1 并行
- **验证：** `pnpm tsc --noEmit && pnpm test && pnpm build`

### Phase 6 门控

```bash
pnpm lint
pnpm tsc --noEmit
pnpm test
pnpm build
pnpm test:e2e
```

---

## Phase 7：配置清理

**目标：** 收窄 `dangerouslyAllowLocalIP` 作用域，评估 TypeScript target 版本。

### 任务 7.1 — dangerouslyAllowLocalIP 改为 dev-only

- **文件：** `next.config.ts`
- **操作：** 将 `dangerouslyAllowLocalIP: true` 改为 `dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production"`
- **注意：** vitest 中 NODE_ENV 默认是 `"test"`，故 `!== "production"` 为 true，现有测试不受影响
- **验证：** `pnpm test src/__tests__/next-config-images.test.ts && pnpm tsc --noEmit`

### 任务 7.2 — 评估并升级 tsconfig.json target（条件执行）

- **文件：** `tsconfig.json`
- **操作：** 将 `"target": "ES2017"` 改为 `"target": "ES2022"`
- **验证步骤（顺序执行，任意失败则回退）：**
  1. `pnpm tsc --noEmit`
  2. `pnpm test`
  3. `pnpm build`
- **预期：** 升级后 TypeScript 正确解析 ES2022 特性类型（Array.at、Object.hasOwn 等），对运行时无影响
- **并行：** 与 7.1 并行

### Phase 7 门控（最终验证）

```bash
pnpm lint
pnpm tsc --noEmit
pnpm test
pnpm build
pnpm test:e2e
```

**所有检查通过即为重构完成。**

---

## 关键注意事项

1. **Phase 0 修改的是测试契约，不是降低覆盖面：** admin/reader e2e 的修改是将断言对齐到实际应用行为。

2. **Phase 1 Dockerfile 修改可能导致 build 失败：** 如有代码在构建时读取 `process.env.DATABASE_URL` 并做非 null 断言，build 会失败。发现问题时检查 `next.config.ts` 和插件是否在 build 时访问这些变量。

3. **Phase 2 任务 2.11 有行为变更：** session 接口出错时从 `{ user: null }` 变为 5xx 错误响应，需确认调用方 `src/lib/auth-client.ts` 对非 200 响应的处理逻辑。

4. **所有删除操作前必须通过 `pnpm tsc --noEmit` 确认无残留引用。**

5. **Phase 6 任务 6.1 的 ButtonProps 兼容性：** admin Button 有额外的 `asChild` prop（默认 false）和 `"icon"` size，TypeScript strict 下可能对 `"icon"` 有警告，若出现需逐一检查调用方。

---

## 验证矩阵（每个 Phase 通用）

```bash
# 基础门槛（每个 Phase 完成后）
pnpm lint
pnpm tsc --noEmit --incremental false --pretty false
pnpm test

# 构建门槛（Phase 0/4/5/6/7）
pnpm build

# 端到端门槛（Phase 0/6/7）
pnpm test:e2e

# 局部快速验证（开发中随时运行）
pnpm exec vitest run src/__tests__/next-config-images.test.ts src/__tests__/middleware.test.ts
pnpm exec vitest run src/lib/__tests__/validation.test.ts src/lib/__tests__/api-errors.test.ts
pnpm exec vitest run src/lib/__tests__/ai-news.test.ts src/lib/__tests__/ai-models.test.ts
pnpm exec vitest run src/app/admin/__tests__/admin-editor.test.tsx
```
