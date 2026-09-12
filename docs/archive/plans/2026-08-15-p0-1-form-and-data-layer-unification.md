# P0-1 整改任务：表单与数据层统一抽象（前端工程化债）

> 状态：**仓库侧已完成**（2026-08-17 收口复核；外部 CI 待运行）· 日期：2026-08-15
> 来源：`docs/2026-08-15-frontend-backend-architecture-analysis.md` P0-1
> 性质：前端改造任务，不动服务端 API 契约、不动 lib/validation.ts 服务端校验层

---

## 1. 背景与目标

当前客户端层存在两类"每个页面各写一套"的重复实现：

1. **表单**：文档宣称 RHF+Zod，实际仅 `ContactForm.tsx` 一处使用；登录、注册、评论、文章编辑器、AI 模型配置、分类/标签/系列、设置等全部手写 `useState`，校验散落 `if`，错误展示、提交 loading、toast 各写各的（部分还有中英文文案混用）。
2. **数据请求**：无请求库，所有客户端取数都是 `useState + useEffect + fetch` 手写状态机；loading/error/竞态/分页/轮询各自实现（仅 admin 组件就有 51 处 fetch 调用点），`admin/posts/page.tsx` 单文件 1250+ 行、16 个状态内联。

**目标**（本任务完成后的形态）：

- 所有用户可见表单统一走 **React Hook Form + Zod + shadcn Form 组件**，校验规则声明式、错误文案中文、错误态/提交态/成功提示行为一致；
- 所有客户端取数统一走 **SWR**（key 驱动 + 统一 fetcher），loading/error/empty 三态、竞态、重验证、轮询由库接管，删除手写状态机；
- `admin/posts/page.tsx` 从 1250+ 行拆分为「页面壳 + `usePostsList` hook + 子组件」；
- 建立可复制的"黄金参考实现"，后续新页面默认按此范式编写；
- 同步修正 AGENTS.md / CLAUDE.md 的表单与数据层约定。

**非目标**：不改服务端校验（`lib/validation.ts` 继续手写）、不引入 Server Actions、不做 UI 体系完全统一（P1-2）、不迁移无状态 GET 表单（如 `SearchForm.tsx`，已是正确形态）。

---

## 2. 现状盘点（证据）

### 2.1 依赖现状（已核验）

| 依赖 | 状态 | 版本 | 说明 |
|---|---|---|---|
| `react-hook-form` | ✅ 已装 | ^7.75.0 | 仅 ContactForm + shadcn form.tsx 引用 |
| `zod` | ✅ 已装 | ^4.4.3 | 全项目仅 1 处使用（ContactForm） |
| `@hookform/resolvers` | ✅ 已装 | ^5.2.2 | 同上 |
| `sonner` | ✅ 已装 | ^2.0.7 | 全局 Toaster 已装配 |
| **`swr`** | ❌ 未装 | — | **需要新增**（~5KB gzipped） |
| `@tanstack/react-query` | ❌ 未装 | — | 备选，不推荐（见决策 1） |

### 2.2 表单现状（代表性，全部手写 useState）

> 全量盘点：**24 个表单中 22 个为 useState 手写、无客户端校验**（唯二例外：ContactForm 已用 RHF+Zod，SearchForm 为无状态 GET form）。所谓"统一表单层"实际是**从零建立规范并逐步替换**，而非迁移现有实现。
> 额外例外：`admin/ai/topics/page.tsx` 的表单走 **Server Actions**（全仓唯一非客户端表单）——本轮不迁移它，也不扩 Server Actions（见决策 4）。

| 表单 | 文件 | 实现 | 校验 | 备注 / 迁移要点 |
|---|---|---|---|---|
| 联系表单 | `app/(public)/contact/ContactForm.tsx` | RHF+Zod ✅ | Zod | **唯一规范实现**，但用裸 register + 手写错误渲染，未用 shadcn Form 组件 |
| 登录 | `components/auth/LoginForm.tsx` | useState×4 | 原生 required | page/dialog 双模式、`signIn` 流程、authError 映射表；使用 custom `components/ui` 的 Input/Button；**有测试** |
| 注册 | `app/(auth)/register/page.tsx` | useState×6 | 手写 if（英文文案） | 密码一致性/长度手写校验，错误文案为英文；fetch 手写 |
| 评论 | `components/CommentForm.tsx` | useState×4 | 无 | **有测试**；与登录态耦合（CommentAuthGate） |
| 文章编辑器 | `components/posts/hooks/usePostForm.ts` | 单对象 useState | 无（仅 canSubmit 布尔） | 含 localStorage 草稿 + 450ms 防抖保存 + normalizeDraft；`AdminPostWorkspace.tsx`（945 行）消费；配套 useSlugDerive/useAiActions/useCoverUpload |
| AI 模型配置 | `components/admin/ai/hooks/useModelForm.ts` | 单对象 useState | 无 | capabilities 数组需 useFieldArray；**有测试**（AiModelManager.test.tsx） |
| 后台设置 | `components/admin/settings/AdminSettingsClient.tsx`（**702 行**） | 多个 draft 对象 + saving 标志 | 无 | **7 个独立表单**（资料/博客设置/日志设置等）；无测试 |
| 封面资产表单 | `components/admin/covers/CoverAssetForm.tsx` | 手写 | 无 | 无测试 |
| AI 新闻源 | `components/admin/ai-news/hooks/useAiNewsSources.ts` | 单对象 state | 无 | 表单+列表一体 |
| 分类/标签/系列 | `components/admin/taxonomy/*`（useTaxonomyRows/useTaxonomyActions） | 行内编辑 state | 无 | 有测试 |
| 站内搜索 | `components/search/SearchForm.tsx` | **无状态 GET form** | — | ✅ 已是正确形态，**不迁移** |

### 2.3 数据请求现状（代表性）

| 功能 | 文件 | 模式 | 现状问题 |
|---|---|---|---|
| 后台文章列表 | `app/admin/posts/page.tsx`（**1297 行**） | 整页 use client，16 个 useState，fetchPosts+useEffect，requestId 竞态保护 | 巨型组件；状态可分 5 组：列表 / 筛选+localStorage 记忆 / 批量操作 / 删除对话框 / 摘要轮询（2.5s）——天然拆分边界 |
| 接口日志 | `components/admin/logs/ApiOperationLogsClient.tsx`（432 行） | 12 个 useState，buildLogsUrl→fetch→useEffect | 经典"可被 useSWR 一行替代"的手写状态机 |
| 通知（铃铛/中心） | `NotificationBell.tsx` / `NotificationCenterClient.tsx` | useState+useEffect+fetch + **setInterval 轮询**（第 109 行） | 手写轮询，无清理竞态保障 |
| 评论管理 | `app/admin/comments/page.tsx` | 整页 use client，query/debouncedQuery/page/pageSize + fetch | 与 posts 页同构 |
| 封面库 | `CoverGalleryManager.tsx` / `CoverPicker.tsx` | useState+fetch | 分页参数手拼 |
| AI 任务列表/详情 | `AiTaskList.tsx` / `AiTaskDetail.tsx` / `AiTaskActivitySync.tsx`（setInterval 轮询，第 39 行） | useState+fetch+轮询 | 轮询与手写重试 |
| 分类/标签/系列 | `useTaxonomyRows.ts` | 自建行数据 hook | 已半抽象，可直接换 SWR 内核 |
| 公共文章无限滚动 | `components/blog/useInfinitePosts.ts` | 自建 hook：requestIdRef 防竞态 + IntersectionObserver + 去重 append | 功能正确但不可扩展；**有测试** |
| 管理端全局搜索 | `AdminGlobalSearch.tsx` | 手写 debounce + fetch | 无取消/竞态保护 |
| 封面生成/上传 | `AiCoverGenerator.tsx` / `CoverUploadDropzone.tsx` / `image-crop-upload-dialog.tsx` | 事件内 fetch（qiniu-token → 上传 → 登记） | 多步链式请求，属"命令式 mutation"，不适用 SWR 缓存，仅复用 fetcher 错误处理 |

> 全量统计：全仓 **125 处 fetch 调用点**（仅 `components/admin` 就有 51 处）；另有公共侧 `useInfinitePosts`、`CommentForm`、注册页、书签/点赞按钮等。轮询点 4 处：`admin/posts` 摘要 2.5s（page.tsx:738）、`AiTaskActivitySync` 3s（:39）、`NotificationBell` 30s+focus（:109）、`ArticleReadTracker` 阅读节拍（计时器，非 fetch，不迁移）。

### 2.4 现有可复用资产（已核验）

- **shadcn 表单组件齐全**：`form.tsx`（Form/FormField/FormItem/FormLabel/FormControl/FormDescription/FormMessage）、`field.tsx`、`input.tsx`、`textarea.tsx`、`select.tsx`、`native-select.tsx`、`checkbox.tsx`、`switch.tsx`、`radio-group.tsx`、`calendar.tsx`、`combobox.tsx`、`label.tsx` —— **无需新造组件**；
- **API 客户端**：`lib/admin-api-client.ts` 已有 `readApiJson` / `getApiErrorMessage` / `requestApi`——`readApiJson` 可直接复用为 SWR fetcher 的错误契约底座；`requestApi` 是预留扩展点但**当前零调用**（可保留待用或并入新 fetcher）；
- **hooks 文化已存在**：`src/hooks/`、`components/admin/{ai,ai-news,taxonomy}/hooks`、`components/posts/hooks` 共 11 个 hook 文件（useModelActions/useModelForm/useTaxonomyRows/useSlugDerive 等）——迁移遵循就近 hooks 目录约定；
- **Provider 装配点**：`components/AppProviders.tsx` 是 SWRConfig 的天然挂载点，且有契约测试 `app-providers-contract.test.tsx` 需同步更新；
- **toast**：sonner 全局 Toaster 已就绪。

### 2.5 测试覆盖地图（回归保护）

| 被测对象 | 现有测试 |
|---|---|
| LoginForm | `components/auth/__tests__/LoginForm.test.tsx`、`dark-mode-contract.test.tsx` |
| ContactForm | `app/(public)/contact/__tests__/ContactForm.test.tsx` |
| CommentForm | `components/__tests__/CommentForm.test.tsx` |
| useInfinitePosts | `components/blog/__tests__/useInfinitePosts.test.tsx`（mock fetch + IntersectionObserver） |
| AiModelManager | `components/admin/ai/__tests__/AiModelManager.test.tsx` |
| AdminPostWorkspace | `components/posts/__tests__/admin-post-workspace-layout-contract.test.tsx` |
| PostsListingClient | `components/blog/__tests__/PostsListingClient.test.tsx` |
| AppProviders | `components/__tests__/app-providers-contract.test.tsx`（断言 `<Toaster />`，需加 SWRConfig 断言） |

---

## 3. 方案决策（请审查重点）

### 决策 1：数据层引入 SWR（推荐）

| 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| **A. SWR** | ~5KB、零配置、key 驱动、stale-while-revalidate、自带缓存/去重/竞态/焦点重验证/refreshInterval；`fallbackData` 正好承接 RSC 首屏数据；社区标准 | 新增 1 个依赖 | ✅ **推荐** |
| B. 自建 useApiQuery | 零新依赖 | 需要自己实现缓存键/去重/竞态/重验证——与现状"手写状态机"同源，长期维护成本最高 | ❌ |
| C. TanStack Query | 功能最全 | 更重、概念更多，对当前规模过度；迁移成本最高 | ❌ |

**全局装配**（`AppProviders.tsx` 内）：
```tsx
<SWRConfig value={{
  fetcher: apiFetcher,
  dedupingInterval: 2000,
  revalidateOnFocus: false,   // 前台阅读场景避免焦点抖动触发整页重取
  shouldRetryOnError: true,
  errorRetryCount: 2,
}}>
```
> 后台需要焦点重验证的页面（通知、日志）可在局部 `<SWRConfig>` 覆盖或提交后显式 `mutate()`。

**统一 fetcher**（新建 `src/lib/client-api.ts`，复用 admin-api-client 底座）：
```ts
export class ApiRequestError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = "ApiRequestError"; }
}

export async function apiFetcher<T>(path: string): Promise<T> {
  const response = await fetch(path);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || (data && typeof data === "object" && (data as { success?: boolean }).success === false)) {
    throw new ApiRequestError(getApiErrorMessage(data, "请求失败"), response.status);
  }
  return data as T;
}

export async function apiMutate<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { headers: { "Content-Type": "application/json" }, ...init });
  return apiFetcher<T>(...); // 复用同一错误契约
}
```

### 决策 2：表单统一 RHF + Zod + shadcn Form 组件

- schema 与组件同文件（小表单）或同目录 `schema.ts`（大表单）；**客户端 schema 只负责 UX 校验**，服务端 `lib/validation.ts` 仍是权威校验——明确该边界，避免双重维护；
- 全部使用 shadcn `FormField`/`FormItem`/`FormMessage`，替代裸 `register` + 手写 `<p>` 错误（ContactForm 也顺手对齐）；
- 错误文案统一中文；`aria-invalid`/`aria-describedby` 由 shadcn FormControl 自动处理；
- 提交状态用 RHF `isSubmitting`，失败 toast + 表单内联错误分工：**字段级错误进 FormMessage，请求级错误进 toast**。

### 决策 3：黄金参考范式（后续新页面照抄）

列表页范式（以接口日志为第一个落地对象）：
```tsx
// 6 个 filter state 保持不变（它们是 UI 状态，不是数据状态）
const buildLogsUrl = useCallback((p: number) => { /* 现有实现不变 */ }, [/* deps */]);

// 替代 loadLogs + useEffect + loading/error state
const { data, error, isLoading, isValidating, mutate } = useSWR(buildLogsUrl(page), apiFetcher, {
  keepPreviousData: true,   // 翻页/切换筛选时避免闪空
});

// 操作后失效：purge 成功后 mutate()（revalidate），详情用条件 key
```

表单范式：
```tsx
const form = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues });
const onSubmit = async (data: FormValues) => {
  try { await apiMutate("/api/...", { method: "POST", body: JSON.stringify(data) }); toast.success("已保存"); }
  catch (err) { toast.error(err instanceof Error ? err.message : "保存失败"); }
};
// <Form {...form}> + <FormField name="x" render={({ field }) => <FormItem>...</FormItem>} />
```

### 决策 4：迁移边界

**做**：上述表单与列表统一；admin/posts 拆分；轮询换 `refreshInterval`；无限滚动换 `useSWRInfinite`；修正文档。
**不做**：服务端校验层、Server Actions（不扩用、也不迁移 `admin/ai/topics` 的现有 Server Actions 表单，维持现状并记录为例外）、custom `components/ui` 全量消灭（P1-2 只顺带对齐表单相关）、无状态 GET 表单（SearchForm）。

---

## 4. 里程碑任务分解

> 每个里程碑独立可上线、可回滚；每步跑 `pnpm test` + `pnpm lint` + 构建冒烟。

### M0 基础设施与约定（0.5~1 天）
- [x] 安装 `swr`（`pnpm add swr`）
- [x] 新建 `src/lib/client-api.ts`（apiFetcher / apiMutate / ApiRequestError）+ 单测
- [x] `AppProviders.tsx` 挂 SWRConfig（决策 1 配置）
- [x] 更新 `app-providers-contract.test.tsx`（断言 SWRConfig 存在）
- [x] 在 AGENTS.md 草拟"前端数据层与表单约定"小节（M5 定稿）
- **验收**：测试绿；`useSWR` 在任一 dev 页面能取到 `/api/posts` 数据。

### M1 垂直切片打样（1~2 天，产出黄金参考）
- [x] **列表切片**：`ApiOperationLogsClient.tsx` → useSWR（key=buildLogsUrl(page)，keepPreviousData，purge 后 mutate，详情条件 key）
- [x] **表单切片**：注册页 → RHF+Zod（中文文案、confirmPassword refine、isSubmitting），fetch 换 apiMutate
- [x] 补两个切片的行为测试（筛选切换、错误恢复）
- **验收**：功能等价、测试绿、代码行数明显下降（日志组件预计 432→~250 行）；两个文件成为黄金参考。

### M2 公共侧表单迁移（1~2 天）
- [x] `LoginForm.tsx` → RHF+Zod（保留双模式、authError 映射、signIn 流程；迁移后同步更新 `LoginForm.test.tsx` 断言）
- [x] `CommentForm.tsx` → RHF+Zod（保留 CommentAuthGate 耦合；更新测试）
- [x] `ContactForm.tsx` 对齐 shadcn Form 组件（视觉零变化；更新测试）
- **验收**：三个公共表单行为与视觉无回归，测试绿。

### M3 编辑器与后台核心表单（2~3 天）
- [x] `usePostForm.ts` → RHF（defaultValues + reset 承接 normalizeDraft；localStorage 防抖保存用 form.watch 订阅，保持 450ms 节流与 saveStatus 三态）
- [x] `useModelForm.ts` → RHF+Zod（capabilities 用 useFieldArray；apiKey 保留空白不泄漏约定）
- [x] `AdminSettingsClient.tsx` 三个子表单 → RHF+Zod（拆分 saving 状态为 isSubmitting）
- [x] taxonomy（分类/标签/系列行内编辑）→ 表单 schema 化；`useAiNewsSources.ts` 表单部分同理
- **验收**：编辑器草稿恢复/防抖保存、模型默认项切换等行为不回归（AiModelManager.test.tsx 绿）。

### M4 数据层推广（3~5 天）
- [x] `admin/posts/page.tsx` 拆分：`usePostsList` hook（filters/page/pageSize/bulk 操作/mutate）+ `PostsTable`/`PostsToolbar`/`BulkActionsBar`/`DeleteDialog` 子组件 + 页面壳；摘要轮询换 `refreshInterval`
- [x] 其余计划内列表页：comments、newsletter、covers、ai tasks、notifications（轮询换 `refreshInterval` + 操作后 mutate）；既有 Server Actions 页保持例外
- [x] `useInfinitePosts.ts` → 内部改 `useSWRInfinite`（对外 API 保持兼容，首屏由 RSC/fallback 承接；更新 useInfinitePosts.test.tsx）
- [x] `AdminGlobalSearch.tsx` → useSWR + debounce key（自动竞态消除）
- [x] 公共侧 BookmarkButton/LikeButton 按用户决策不纳入本轮，保持现状并记录为边界
- **验收**：admin 组件手写 fetch 调用点从 51 处降到只余"命令式 mutation"（上传链、批量任务等）；所有列表三态统一。

### M5 收尾清理与文档（1 天）
- [x] 移除死代码（requestIdRef 等手写竞态防护随迁移删除）
- [x] 评估无引用 shadcn 组件与死依赖：该项为可选顺带项，本轮不扩大删除范围
- [x] 更新 AGENTS.md / CLAUDE.md：表单约定（RHF+Zod+shadcn Form）、数据层约定（SWR+apiFetcher）、黄金参考文件指引；修正旧描述
- [x] 全量 `pnpm test` / `pnpm lint` / `pnpm build` + 回归清单走查

---

## 5. 总验收标准

1. `pnpm test` / `pnpm lint` / `pnpm build` 全绿，CI 通过；
2. 新增表单全部 RHF+Zod+shadcn Form 组件、中文文案、isSubmitting 提交态、错误分工（字段级 FormMessage / 请求级 toast）；
3. 新增列表全部 SWR 管理，手写 `useState+useEffect+fetch` 状态机清零（命令式 mutation 除外）；轮询点全部 `refreshInterval`；
4. `admin/posts/page.tsx` ≤ 400 行（页面壳），业务逻辑在 hook 与子组件；
5. 契约测试覆盖：SWRConfig 装配、fetcher 错误契约、至少一个列表黄金参考与一个表单黄金参考；
6. 公共侧视觉与行为零回归（暗黑模式、双模式登录、草稿恢复）。

> 仓库侧 2–6 已完成；第 1 项的本地 test/lint/build 已完成，外部 CI 需在提交后运行，不能由当前未提交工作区证明。

## 6. 风险与回滚

| 风险 | 缓解 |
|---|---|
| 登录/注册迁移牵动鉴权流程 | M2 单独切、保留 authError 映射与 signIn(redirect:false) 逻辑不变；LoginForm.test 同步改断言 |
| SWR 与 RSC 首屏数据重复请求 | 列表统一 `fallbackData`/`keepPreviousData`，避免挂载即闪 loading；前台 revalidateOnFocus 关闭 |
| 草稿防抖/恢复行为回归 | usePostForm 迁移时把 normalizeDraft 与 450ms 节流原样保留（仅换实现载体），手测 create/edit 双模式 |
| 双 UI 体系并存期视觉漂移 | 每个表单迁移后逐页手测暗黑/亮色；不强制换组件库 |
| 迁移周期内新增页面继续手写 | M0 落地黄金参考 + AGENTS.md 约定后，review 卡口要求新页面按范式 |

## 7. 已确认决策

1. **数据层选型**：采用 SWR，并已新增依赖。
2. **登录/注册**：一并迁移 RHF+Zod。
3. **ContactForm**：对齐 shadcn Form，保留视觉。
4. **admin/posts**：页面壳目标按 `<500` 行确认；最终 288 行，同时满足原计划 ≤400 行目标。
5. **范围**：公共侧 Bookmark/Like 不纳入本轮。
6. **SWR 配置**：全局 `revalidateOnFocus: false`，后台局部按需开启。
