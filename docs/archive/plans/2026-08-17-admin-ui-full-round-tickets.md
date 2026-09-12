# 后台 UI / 交互 / 动效 全量修复 — 工单拆分（2026-08-17）

> 来源：`docs/plans/2026-08-17-admin-ui-full-round.md`（实施计划）+ `docs/plans/2026-08-17-admin-ui-full-round-spec.md`（Spec）
> 状态：本地工单，尚未发布到 GitHub Issues（发布命令见文末）。发布时按依赖顺序创建，全部打 `ready-for-agent` 标签。
> 拆分明细：由 14 张细票合并为 7 张（用户确认：粒度太细想合并；依赖与全 AFK 标记认可；先存本地）。
> 测试缝：全部为既有 Vitest 组件/集成测试层，不新增 e2e 缝；每张票自带回归测试，T7 做全量收口。

---

## T1 发布确认 + 通用 ConfirmDialog（P0）

类型：AFK ｜ 依赖：无 ｜ 用户故事：US 1, 2, 3

### What to build

新增后台通用确认弹窗组件（基于既有 AlertDialog 封装，支持 `title / description / confirmLabel / cancelLabel / tone: danger|default / submitting / impacts?`），并接入文章发布全部三个入口：文章列表行级发布、批量发布、文章工作台编辑器提交（`intent === "publish"`）。

**只拦「发布」方向**：发布弹窗说明「发布后立即对读者可见」；批量发布弹窗展示受影响篇数（>5 篇突出提示）；「转草稿」保持一键切换、仅 toast 反馈、不弹窗；编辑器 draft/schedule 提交不拦截。确认→调用真实 API，取消→不调用；按钮 busy 态保留。

实现范围（文件级，以计划为准）：`components/admin/ui/confirm-dialog.tsx`（新增）、`components/admin/posts-ui.tsx`（PublishToggleTag 改触发 onRequestTogglePublish）、`components/admin/posts/hooks/usePostsList.ts`（仅 nextPublished===true 触发确认）、`app/admin/posts/page.tsx`（挂弹窗 + “AI OPS”→“AI 运维”）、`components/posts/AdminPostWorkspace.tsx`（发布提交拦截）。

### Acceptance criteria

- [ ] ConfirmDialog 支持五类确认场景所需 props，亮/暗色下均正常
- [ ] 行级发布：点击弹窗→确认调发布 API、取消不调
- [ ] 批量发布：弹窗展示篇数（>5 篇突出），确认→批量 API
- [ ] 转草稿：不弹窗，一键切换并 toast
- [ ] 编辑器：intent=publish 弹窗，draft/schedule 不拦截
- [ ] 组件测试：ConfirmDialog 渲染/回调/提交态；三入口确认与取消；转草稿直通

## T2 危险运维确认与反馈统一

类型：AFK ｜ 依赖：T1（ConfirmDialog）｜ 用户故事：US 5, 6, 7, 15（+ US 8/12 相关项）

### What to build

把其余四类确认全部迁移到 T1 的 ConfirmDialog，并补齐反馈闭环：

- 接口日志清理：确认弹窗写明「删除 30 天前记录」；成功 `toast.success`、失败 `toast.error`，移除静默吞错路径；成功/失败数字改语义色 token；空态用 Empty 组件
- 「重新生成今日日报」：确认弹窗提示覆盖当日内容
- GitHub 解绑、封面归档：原生 `window.confirm` 替换为应用内 ConfirmDialog（键盘可用、体验一致）
- AI 新闻来源表单：10 字段按「基本信息 / 抓取与校验」分组（fieldset + legend），不改提交逻辑；AI 新闻错误盒改语义色

实现范围：`components/admin/logs/ApiOperationLogsClient.tsx`、`app/admin/ai-news/page.tsx`、`components/admin/ai-news/AiNewsSourceFormDialog.tsx`、`components/admin/ai/GitHubBinding.tsx`、`components/admin/covers/CoverGalleryManager.tsx`（+ 对应测试）。

### Acceptance criteria

- [ ] 日志清理：确认弹窗→成功/失败 toast，无静默失败路径
- [ ] 日报重生成：覆盖确认弹窗
- [ ] GitHub 解绑、封面归档：应用内确认弹窗（无原生 confirm 残留）
- [ ] 来源表单分组渲染，提交逻辑与校验不变
- [ ] 相关组件测试更新/新增并通过

## T3 文章分页收敛

类型：AFK ｜ 依赖：T1（同改 `posts-ui.tsx`）｜ 实现决策 3

### What to build

统一分页组件词汇：文章列表改用既有 AdminPagination（客户端 onPageChange 路径，翻页不整页刷新、保留 SWR 缓存）；删除文章工作台侧的重复分页实现（PaginationBar）与重复页码工具函数；表头 `PAGE 1 / 5`→`第 1 / 5 页`、`rows`→`条记录`；同步更新 posts 相关测试。

实现范围：`components/admin/PostsTable.tsx`、`components/admin/posts-ui.tsx`（删 PaginationBar/getPaginationItems/clampPage）、posts 测试。

### Acceptance criteria

- [ ] 翻页为客户端切换，无整页刷新，SWR 缓存保留
- [ ] 重复分页组件与页码工具函数已删除
- [ ] 表头文案中文（第 1 / 5 页、条记录）
- [ ] 相关测试通过

## T4 编辑器与 AI 交互细节

类型：AFK ｜ 依赖：无 ｜ 用户故事：US 4, 13, 14

### What to build

- 编辑器格式按钮（加粗/标题/引用等）：改为在光标处/选区包裹插入 Markdown 标记（selectionStart/End），插入后聚焦 textarea 并恢复选区——不再文末追加；补组件测试
- AI 任务轮询降噪：活跃轮询 `refreshInterval` 3s→10s，`router.refresh()` 去抖（仅任务状态可能变化时触发）
- 批量 AI 补全：「自动应用」默认关闭（需人工勾选），成功盒改语义色

实现范围：`components/admin/editor/MarkdownEditor.tsx`、`components/admin/ai-tasks/AiTaskActivitySync.tsx`、`components/admin/ai/BulkAiCompletionDialog.tsx`（+ 对应测试）。

### Acceptance criteria

- [ ] 格式按钮在光标处/选区包裹插入，焦点与选区恢复（组件测试断言插入位置）
- [ ] 轮询间隔 10s，路由刷新去抖
- [ ] 自动应用默认 false，需人工勾选
- [ ] 相关测试通过

## T5 动效、主题与页面细节收敛

类型：AFK ｜ 依赖：无 ｜ 用户故事：US 8, 16, 17, 19, 20, 21, 22（+ US 18 相关项）

### What to build

删除装饰性动效、补齐主题 token 与页面细节：

- 动效删除：标签栏激活呼吸圆点（改静态或移除）、侧栏激活项与 logo 发光投影、筛选栏 teal 长阴影、AI 接口页 34px 装饰阴影、dashboard 三处 hover 位移、comments hover 放大；保留 Radix 弹层 fade/zoom 与全局 prefers-reduced-motion 兜底
- 死参数：移除 WorkspacePanel 的 reveal prop 及调用点（不做入场编排）
- 主题：后台亮色补 `--text-faint: #64748b`（仅 `.admin-theme` 作用域，不影响前台）；NotificationBell severity 改语义色 + 未读点加 `role="img"` 与 aria-label；dashboard 缩略图占位渐变改语义 token
- 细节：Modal 无标题不再兜底 sr-only「弹窗」，改可选 ariaLabel prop；dashboard/comments 的 10px 提示字提升为 text-xs；页脚伪帮助链接改为「Ctrl+K 全局搜索」真实提示；comments 无 hint 时不再渲染伪「运行正常」绿点（仅真实状态时显示）、StatsCard 改语义色
- 文案：TaxonomyStudio “Structure”→“内容”；DeleteImpactDialog “Danger Zone”→“危险操作”

实现范围：`src/styles/theme-variables.css`、`components/admin/AdminSider.tsx`、`components/admin/AdminTabsBar.tsx`、`components/admin/FilterBar.tsx`、`app/admin/ai/interfaces/page.tsx`、`components/admin/WorkspacePanel.tsx`、`components/admin/ui/Modal.tsx`、`components/admin/NotificationBell.tsx`、`app/admin/page.tsx`、`app/admin/comments/page.tsx`、`components/admin/taxonomy/TaxonomyStudio.tsx`、`components/admin/DeleteImpactDialog.tsx`。

### Acceptance criteria

- [ ] 装饰动效无残留（pulse 圆点 / hover 位移 / hover 放大 / 发光投影 / 彩色长阴影）
- [ ] reveal 死参数已移除、无调用点残留
- [ ] Modal 支持 ariaLabel，无 sr-only 兜底文案
- [ ] 通知未读点可被读屏播报；severity 走语义 token
- [ ] `--text-faint` 亮色对比度达 WCAG AA，且不影响公共前台
- [ ] 伪「运行正常」绿点仅在真实状态时显示
- [ ] 相关文案中文化；缩略图渐变在暗色下不穿帮
- [ ] 相关测试通过

## T6 无障碍与空态

类型：AFK ｜ 依赖：无 ｜ 用户故事：US 9, 10, 11, 12（+ US 18 相关项）

### What to build

- 设置页 tablist：roving tabindex + 左右方向键 + Home/End
- 面包屑：crumbs 改为 `{label, href}[]`，非末级渲染为链接、末级为当前页文本
- DataTable：行复选框 aria-label 改为「选择第 N 行」；loading/空态补 `role="status"`；新增 `emptyState?: ReactNode` prop，默认用 Empty（图标+文案），taxonomy / comments / newsletter 调用点自动受益
- AiTaskList 空态教学化（Empty + 下一步提示）
- 文案：AdminSettingsClient eyebrow “Account”→“账号”

实现范围：`components/admin/settings/AdminSettingsClient.tsx`、`components/admin/AdminBreadcrumbs.tsx`、`components/admin/shell/config.ts`、`components/admin/ui/DataTable.tsx`、`components/admin/ai-tasks/AiTaskList.tsx`（+ 对应测试）。

### Acceptance criteria

- [ ] tablist 方向键/Home/End 导航（组件测试断言激活标签变化）
- [ ] 面包屑非末级可导航、末级为文本
- [ ] 复选框 aria-label 使用行序号（测试断言）
- [ ] loading/空态带 role="status"；DataTable emptyState 生效（taxonomy/comments/newsletter 受益）
- [ ] AiTaskList 空态教学化
- [ ] 相关测试通过

## T7 全量验证与评审快照更新

类型：AFK ｜ 依赖：T1–T6 全部完成 ｜ 用户故事：US 23

### What to build

全量收口：`pnpm test` → `pnpm lint` → `pnpm build` 全绿；后台相关 Playwright smoke（如存在）跑一遍；按结果更新 `.impeccable/critique/src-app-admin.md` 问题清单状态（或按需复评）。

### Acceptance criteria

- [ ] pnpm test 全绿
- [ ] pnpm lint 通过
- [ ] pnpm build 通过
- [ ] 评审快照问题状态已更新

---

## 发布说明（暂缓执行）

用户已确认：先存本地、不发布。如需发布到 `RoyDust/ai-blog`：

```bash
# 按 T1 → T7 顺序创建，第一条不带 Blocked by，后续用真实 issue 号互相引用；全部打 ready-for-agent 标签
gh issue create --title "T1 发布确认 + 通用 ConfirmDialog（P0）" --body-file docs/plans/tickets/t1.md --label ready-for-agent
```

（发布时按 issue 模板补全 `## Parent` / `## Blocked by` 段，引用真实 issue 号。）
