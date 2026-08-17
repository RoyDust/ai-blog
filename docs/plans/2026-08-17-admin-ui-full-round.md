# 后台 UI / 交互 / 动效 全量修复计划（2026-08-17）

> 依据：Impeccable 评审（25/40，P0×1 / P1×3 / P2×4，见 .impeccable/critique/src-app-admin.md）
> 用户决策：发布确认统一用 AlertDialog 弹窗，但**只拦「发布」方向**（转草稿保持一键，不弹窗）；本轮 P0–P3 全量一轮做完，先计划后执行。

## 0. 目标与边界

- 目标：把后台从「可用但不可信」拉到「可信、一致、暗色完整、动效克制」。
- 原则：不引入新依赖；复用现有 AlertDialog / Empty / AdminPagination / token；所有改动保持现有 API 契约与测试风格；动效全部吃全局 prefers-reduced-motion（已具备）。
- 明确不做：不改数据模型/API 契约；不重构编辑器内核；不做路由级重排；全局 4px 细滚动条保持（公共端一致，属设计决策）。

## 1. Phase A — 基础设施（先铺路，后续所有阶段依赖）

1. 新建 `src/components/admin/ui/confirm-dialog.tsx`：基于 AlertDialog 的通用确认弹窗（title / description / confirmLabel / cancelLabel / tone: danger|default / submitting / impacts?）。统一承载发布、清日志、重生成日报、解绑 GitHub、归档封面五类确认。
2. `src/styles/theme-variables.css`：`.admin-theme` 亮色补 `--text-faint: #64748b`（解决 ≈3.0:1 对比度，仅作用后台，不影响前台阅读端）。
3. 状态色统一改走 `--success-* / --warning-* / --danger-*` token：`admin/ui/badge.tsx`、NotificationBell severityMeta、AdminGlobalSearch 图标底色、日志页成功/失败数字、ai-news 错误盒、BulkAiCompletionDialog 成功盒、comments StatsCard。

## 2. Phase B — P0 发布确认（AlertDialog，仅发布方向）

1. `posts-ui.tsx`：`PublishToggleTag` 点击不再直接切换，改为触发父级 `onRequestTogglePublish`（保持按钮外观与 busy 态）。
2. `usePostsList.ts`：确认状态只在 `nextPublished === true`（发布方向）时触发；`published → 草稿` 保持原一键行为（仅 toast 反馈）。批量发布仅发布方向弹窗，>5 篇在弹窗内展示篇数。
3. `src/app/admin/posts/page.tsx`：挂载 `ConfirmDialog`（发布=default tone，文案写明影响：「发布后立即对读者可见」）。
4. `src/components/posts/AdminPostWorkspace.tsx`：编辑器内 `intent === "publish"` 提交前走 ConfirmDialog（draft/schedule 不拦截）。

## 3. Phase C — P1 一致性收敛

1. 分页合并：删除 `posts-ui.tsx` 的 `PaginationBar / getPaginationItems / clampPage`，`PostsTable.tsx` 改用 `AdminPagination`（客户端 onPageChange 路径，不整页刷新）；同步更新 posts 相关测试。
2. 原生 confirm 替换：`CoverGalleryManager.tsx:186`（归档封面）、`GitHubBinding.tsx:32`（解绑 GitHub）→ `ConfirmDialog`。
3. 轮询收敛：`AiTaskActivitySync.tsx` `refreshInterval: 3000 → 10000`，`router.refresh()` 去抖（仅任务状态可能变化时触发），减少请求风暴与操作日志噪音。
4. 编辑器光标感知：`MarkdownEditor.tsx` 格式按钮改用选区包裹（selectionStart/End），插入后聚焦 textarea 并恢复选区；补组件测试。

## 4. Phase D — P2 运维反馈 / 表单 / a11y / 空态

1. 危险运维动作反馈：
   - `ApiOperationLogsClient.tsx`：清理按钮 → ConfirmDialog（写明删除 30 天前记录）；成功 `toast.success`、失败 `toast.error`（去掉静默 `void purgeError`）。
   - `ai-news/page.tsx`：「重新生成今日日报」→ ConfirmDialog（提示覆盖当日内容）。
2. 表单墙收敛：
   - `BulkAiCompletionDialog.tsx`：`applySafeFields` 默认 `true → false`（自动应用默认关闭，需人工勾选）。
   - `AiNewsSourceFormDialog.tsx`：10 字段按「基本信息 / 抓取与校验」分组（fieldset + legend），不改提交逻辑。
3. a11y：
   - `AdminSettingsClient.tsx` tablist：补 roving tabindex + 左右方向键 + Home/End。
   - `AdminBreadcrumbs.tsx` + `shell/config.ts`：crumbs 改为 `{label, href}[]`，非末级渲染为链接，末级为当前页文本。
   - `DataTable.tsx`：行复选框 aria-label 改为「选择第 N 行」；loading/空态补 `role="status"`。
   - `--text-faint` 后台覆盖（Phase A）；后台 `text-[10px]` hint（dashboard / comments）提升为 `text-xs`。
4. 空态教学化：
   - `DataTable.tsx` 增加 `emptyState?: ReactNode`，默认用 Empty（图标+文案），taxonomy / comments / newsletter 三个调用点自动受益。
   - `AiTaskList.tsx`、`ApiOperationLogsClient.tsx` 空态改为 Empty 组件（带下一步提示）。

## 5. Phase E — 动效（删噪音 + 保留状态反馈）

1. 删：`AdminTabsBar.tsx:35` animate-pulse 圆点（改静态圆点或移除）；dashboard 三处 `hover:translate-x-1`（改背景色反馈）；comments `group-hover:scale-110`；`AdminSider.tsx` 激活项与 logo 发光投影；`FilterBar.tsx` 青色长阴影（shadow-none）；`ai/interfaces/page.tsx:63` 34px 装饰阴影归一。
2. 死参数：移除 `WorkspacePanel` 的 `reveal` prop 及其调用点（不做入场编排，符合 product register）。
3. 保留/确认：Radix Dialog/AlertDialog 自带 fade/zoom（150-200ms）；发布成功 toast + 按钮 busy 态；全局 reduced-motion 兜底不动。

## 6. Phase F — 文案与杂项（P3）

1. 英文残留：`PostsTable` 表头 `PAGE 1 / 5`→`第 1 / 5 页`、`rows`→`条记录`；`AdminSettingsClient` eyebrow "Account"→"账号"；`TaxonomyStudio` "Structure"→"内容"；`DeleteImpactDialog` "Danger Zone"→"危险操作"；`posts/page.tsx:83` "AI OPS"→"AI 运维"。
2. `Modal.tsx`：无标题时不再兜底 sr-only「弹窗」，改为可选 `ariaLabel` prop。
3. dashboard 缩略图占位渐变硬编码 `#f4f1ea→#d7e6dc` → `var(--surface-alt)` token（暗色不穿帮）。
4. 通知铃铛未读圆点：加 `role="img"` + aria-label（读屏可播报）。
5. 伪健康指示：`comments/page.tsx:198` 无 hint 时不再渲染「运行正常」绿点（仅在有真实状态时显示）。
6. 页脚伪帮助链接：移除「帮助文档 ↗」纯文本，改为「Ctrl+K 全局搜索」提示文案（真实可用信息）。

## 7. Phase G — 测试与验证

1. 更新既有测试：AdminPagination / posts 工作台（发布确认流）/ ApiOperationLogsClient（purge 确认 + toast）/ AdminSettingsClient（tablist 键盘）/ MarkdownEditor（选区插入）/ DataTable（emptyState、aria-label）/ taxonomy、comments。
2. 新增测试：ConfirmDialog 渲染与回调；发布确认（行级发布/批量发布/编辑器发布）打开→确认→调 API、取消→不调；**转草稿方向不弹窗直接调 API**；purge 失败 toast；tablist 方向键。
3. 全量验证：`pnpm test` → `pnpm lint` → `pnpm build`；后台相关 Playwright smoke（如存在）跑一遍。
4. 完成后更新 `.impeccable/critique/src-app-admin.md` 问题清单状态（或按需复评）。

## 8. 文件清单（预计）

新增：confirm-dialog.tsx

修改：theme-variables.css、admin/ui/badge.tsx、posts-ui.tsx、usePostsList.ts、posts/page.tsx、AdminPostWorkspace.tsx、PostsTable.tsx、MarkdownEditor.tsx、AiTaskActivitySync.tsx、CoverGalleryManager.tsx、GitHubBinding.tsx、ApiOperationLogsClient.tsx、ai-news/page.tsx、BulkAiCompletionDialog.tsx、AiNewsSourceFormDialog.tsx、AdminSettingsClient.tsx、AdminBreadcrumbs.tsx、shell/config.ts、DataTable.tsx、AiTaskList.tsx、AdminTabsBar.tsx、app/admin/page.tsx、comments/page.tsx、AdminSider.tsx、FilterBar.tsx、ai/interfaces/page.tsx、WorkspacePanel.tsx、Modal.tsx、NotificationBell.tsx、DeleteImpactDialog.tsx + 对应测试文件

## 9. 风险与回滚

- 高风险点：PostsTable 分页迁移（牵连 posts 工作台测试）、发布确认新增（可能影响 editor-publish-flow 契约测试）→ 每个 Phase 完成后跑对应单测再进下一 Phase。
- 回滚：按 Phase 提交粒度保留 git 记录，单 Phase 出问题只回滚该 Phase。