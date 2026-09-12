# P0-1 实施记录：表单与数据层统一抽象

> 状态：仓库侧已完成 · 日期：2026-08-15，2026-08-17 收口复核
> 方案：`docs/plans/2026-08-15-p0-1-form-and-data-layer-unification.md`
> 用户决策：① 引入 SWR ② 登录/注册一并迁移 ③ ContactForm 对齐 shadcn Form 组件 ④ admin/posts 页面壳 <500 行 ⑤ 公共侧 Bookmark/Like 不纳入本轮 ⑥ revalidateOnFocus 全局关闭、后台局部按需

## 约定落地（最终形态）

1. **统一 API 客户端**：`src/lib/client-api.ts` —— `apiFetcher`（SWR 全局 fetcher）、`apiMutate`（POST/PATCH/DELETE 默认 JSON 头）、`parseApiResponse`（HTTP 非 2xx 或业务 `success:false` 抛 `ApiRequestError`）、`toErrorMessage`。错误文案复用 `admin-api-client.ts` 的 `getApiErrorMessage`，与后台既有契约一致。
2. **SWR 全局装配**：`AppProviders.tsx` 挂 `SWRConfig`（fetcher=apiFetcher、dedupingInterval=2000、revalidateOnFocus=false、errorRetryCount=2、errorRetryInterval=5000）；契约测试同步断言。
3. **表单标准**：RHF + `zodResolver` + zod；字段级错误走组件错误态（admin 用 shadcn `FormMessage`，公共页用自定义 Input 的 `error` prop），请求级错误 `toast.error(toErrorMessage(...))`；**认证表单例外**：登录错误保留内联 banner（原 UX + 测试约束）；错误文案中文；提交态 `isSubmitting`。
4. **公共页视觉零回归**：LoginForm/注册页/CommentForm 保留自定义 `components/ui` 视觉组件，仅换逻辑层；ContactForm 按用户决策对齐 shadcn Form 组件（twMerge className 覆盖保持视觉类名一致）。
5. **黄金参考**：列表 `src/components/admin/logs/ApiOperationLogsClient.tsx`（useSWR + keepPreviousData + 条件 key 详情 + apiMutate+mutate）；表单 `src/app/(public)/contact/ContactForm.tsx`（FormField 范式）与 `src/app/(auth)/register/page.tsx`（zod refine 范式）。

## 里程碑进度

### M0 基础设施 ✅
- `pnpm add swr` → swr@2.5.1
- 新建 `src/lib/client-api.ts` + 10 个单测（`src/lib/__tests__/client-api.test.ts`）
- `AppProviders.tsx` 挂 SWRConfig；`app-providers-contract.test.tsx` 断言更新

### M1 垂直切片 ✅
- `ApiOperationLogsClient.tsx`：useSWR 列表 + keepPreviousData + 详情条件 key + purge apiMutate/mutate（460→417 行）；测试同步（去掉 `cache:"no-store"` 断言）
- 注册页：RHF+Zod（email/密码强度/一致性/条款）+ 中文文案 + apiMutate（顺带修正整页英文旧 UI 与全站中文不一致）

### M2 公共侧表单 ✅
- `LoginForm.tsx`：RHF+Zod，双模式/文案覆盖/authError 映射/错误内联 banner 全部保留；6 个既有测试零修改通过
- `CommentForm.tsx`：RHF+Zod（1~5000 字）+ apiMutate（保留 x-browser-id 头）+ toast 错误；3 个既有测试零修改通过
- `ContactForm.tsx`：对齐 shadcn Form 组件（FormField/FormItem/FormLabel/FormControl/FormMessage），视觉类名逐一保留；3 个既有测试零修改通过

### M3 / M4 实施结果（本会话）

- ✅ M4a：`admin/posts` 拆分（1297 → 288 行页面壳 + `usePostsList.ts` + `PostsTable.tsx` + `posts-ui.tsx`），相关回归通过
- ✅ M4a：`admin/comments` SWR 化（timer 防抖保语义，壳常驻），6/6 测试绿
- ✅ M4b：`useInfinitePosts` 使用 `useSWRInfinite`（首屏承接、分页、筛选重置、重试、去重及加载中保留既有内容）
- ✅ M4b：`AdminGlobalSearch`（useDeferredValue + SWR）
- ✅ M4b：通知铃铛 + 通知中心（refreshInterval + onSuccess 本地同步 + 乐观已读）
- ✅ M4b：AiTaskActivitySync（refreshInterval）、AiTaskDetail（apiMutate）；AiTaskList 确认为纯展示组件无需迁移
- ✅ M4b：CoverPicker + CoverGalleryManager（SWR + 防抖 + functional mutate 乐观更新）
### 迁移完成 ✅（计划范围）

| 文件 | 结果 |
|---|---|
| M4c 四页（newsletter/series/topic-guides/ai-news） | ✅ SWR 化（双请求并行、动作 apiMutate、候选明细条件加载） |
| `useModelForm` + `AiModelManager` | ✅ 真实 RHF+Zod（RHF 单一数据源 + zod 校验 + handleSubmit + 错误呈现） |
| `usePostForm` + `AdminPostWorkspace` | ✅ RHF 内核（API 完全兼容 + 引用稳定 + 草稿防抖保留） |
| `useAiNewsSources` | ✅ 数据层 SWR 化（loadSources 兼容别名保留） |
| `AdminSettingsClient` | ✅ 账号、博客分区与日志设置完整 RHF+Zod；提交态统一使用 `isSubmitting` |
| taxonomy（`useTaxonomyRows` 等） | ✅ 数据层 SWR 化（setRows 保留为乐观 mutate 包装；测试补 resetModules+ok:true+缓存清理） |

**收口复核**：计划内客户端数据表单已使用 RHF + Zod + `isSubmitting`；部分筛选、tab、对话框和忙碌态仍使用 `useState`，不属于表单权威校验边界。无状态 GET 表单、既有 Server Actions 与用户明确排除的 Bookmark/Like 保持原方案。

最终审查额外修复了三个横切问题：局部 SWR `onError` 先调用 `handleGlobalSwrError` 以保留后台 401 登录跳转；生产 hook 不再用 `dedupingInterval: 0` 迁就测试，测试改用独立 SWR provider；无限列表加载后续页时保留已渲染内容，不再闪空。

### 最终验证
- `pnpm test`：260 个文件 / 1014 项通过 ✅
- `pnpm lint`：0 error / 0 warning ✅
- `pnpm exec tsc --noEmit`：0 ✅
- `pnpm prisma validate`：schema valid ✅
- `pnpm prisma migrate status`：28 个迁移，数据库 schema 已是最新 ✅
- `pnpm build`：通过，生成 278 个静态页面 ✅

执行约定已写入 AGENTS.md/CLAUDE.md"前端数据层与表单约定"（useSWR 选项组合、错误分工、react-hooks 规则、SWR 测试要点），后续轮次按该节 + 黄金参考（`ApiOperationLogsClient` / `usePostsList` / `ContactForm`）机械执行即可。

### M5 ✅
- [x] 全量 `pnpm test`、`pnpm lint`、`pnpm build`（260 个文件 / 1014 项测试，278 个静态页面）
- [x] AGENTS.md / CLAUDE.md：技术栈补 SWR；修正"入参校验用 Zod"漂移；新增"前端数据层与表单约定"小节（保留另一路工作流内容）
- [x] "整改后"复测 + `perf-comparison.md` 对比报告
- [x] 死代码清理：requestIdRef 等随 useInfinitePosts 重写移除

## 环境与并发注意
- 仓库内同时整合了软删除唯一索引、internal-secrets、security-headers、blog-settings 与 cron 路由等整改；最终通过共享工作区差异审查和全量门禁统一验收，性能对比仍按原测量时点注明归因边界。
- 基线数据：`perf-baseline.json`（Playwright 3 次中位数）/ `build-baseline.json`（.next 产物统计）；基线测量环境：本机 `pnpm build` + `pnpm start`（无缓存 Chromium 上下文）。
