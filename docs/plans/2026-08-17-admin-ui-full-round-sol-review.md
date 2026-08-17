# GPT-5.6 Sol 对抗性审查报告 — 后台 UI 全量修复（2026-08-17）

> 审查模型：a6api / gpt-5.6-sol（GPT-5.6 Sol，xhigh 推理档，workflow 双实例并行）
> 审查对象：T1-T7 工单全部改动（docs/plans/2026-08-17-admin-ui-full-round-tickets.md）
> 裁决：Reviewer A「不建议合并」（P1×5 / P2×4）；Reviewer B「不通过」（P1×3 / P2×7 / P3×1）。去重后 P1×7、P2×11、P3×1。
> 复核：父级已对关键指控做代码核验，属实项见各条标注。

---

## P1（7 项，合并阻断）

1. **编辑器 Enter 隐式提交绕过发布确认**（AdminPostWorkspace.tsx:389-406, 821-829）— ✅已核验
   - 无 submitter 时 intent=null，`published = formData.published`；「切换为已发布」按钮写入 published:true → 切状态后按 Enter 可直接发布，绕过确认弹窗。
   - 建议：提交前计算最终 published，凡 false→true 的最终提交统一过确认；补键盘 Enter 组件测试。
2. **ConfirmDialog 双击竞态**（confirm-dialog.tsx:73-81）— 代码事实成立
   - 无同步互斥，快速双击可在重渲染前调用 onConfirm 两次；父级 guard 读旧渲染的 submitting 快照同样不可靠。
   - 建议：组件内同步 ref 锁 + 连续点击测试断言 API 只调一次。
3. **批量发布快照漂移**（usePostsList.ts:421-451, 462-482）
   - 弹窗冻结 count/ids，但 updateBulkPublish 确认时按当前 posts 二次过滤，弹窗显示 N 篇、实际发送 M 篇（只缩不扩）。
   - 建议：确认后提交冻结 ids，不再二次过滤。
4. **AdminPagination effect 内同步 setState**（AdminPagination.tsx:90-93）— ✅已核验
   - 违反 AGENTS.md「不在 effect 体内同步 setState」；建议改渲染期条件调整。
5. **发布确认测试偏离唯一测试缝**（usePostsList.publish-confirm.test.tsx）
   - renderHook 断言 publishDialog.open/count 等内部状态，未用 user-event；建议迁移到页面/组件层断言外部行为（弹窗可见、API body、toast）。
6. **BulkAiCompletionDialog 手写 fetch**（:62-95）— A/B 双报告
   - 绕过 apiMutate/ApiRequestError/toErrorMessage 契约，网络错误可能暴露英文原文；对应测试还把违规实现固化为断言。
7. **AdminGlobalSearch effect 内 setState + eslint-disable**（:154-157）— ✅已核验
   - `setShortcutLabel` 在 effect 内，用 eslint-disable 压制硬规则；建议 useState initializer 或事件时计算。

> 附：Reviewer B 将 NotificationBell 请求错误无 toast 列为 P1（仅 setError，未 toast.error），父级核验 SWR onError 有 handleGlobalSwrError + setError；文案已经 toErrorMessage，但确无请求级 toast——按 AGENTS.md 归为 P2 更准确，已降级。

## P2（11 项）

1. GitHubBinding 解绑：手写 fetch + 失败也关闭弹窗（:33-62）— ✅已核验
2. ai-news 日报重生成：失败后仍无条件关闭确认弹窗（:261-294, 315-327）
3. 通知未读重复播报：按钮 aria-label 已含计数，内部 role=img 角标重复暴露；列表项未读点同样重复（NotificationBell.tsx:74,163-173,220-223）
4. text-[10px] 残留 2 处：NotificationBell 角标 :170、AiNewsSourceCard.tsx:66 — ✅已核验
5. Modal 类型允许无名 dialog：title/ariaLabel 均可选，测试还认可无名 dialog（modal.tsx:12-45）
6. DataTable 行号语义：全局序号（activePage-1）*pageSize+rowIndex vs 用户所见渲染序；现有测试只覆盖第一页（DataTable.tsx:213-230）
7. ai/interfaces 页硬编码 emerald/amber（:39,49,152,174）— ✅已核验
8. AdminTabsBar/AdminSider 的 transition-all/duration 动效残留（TabsBar:27、Sider:55,101,107 等）— ✅已核验（计划未点名 transition，属争议项）
9. comments 页：SWR 失败与真实空列表 UI 不可区分，测试把失败显示「暂无评论」当成功行为（comments/page.tsx:246-264,493-501）
10. ApiOperationLogsClient.test 真实 2100ms sleep 规避 deduping（:96-98）— ✅已核验，违反 SWR 测试约定并拖慢测试
11. NotificationBell：markAllRead/openNotification 直接读 error.message、硬编码文案（:122-135,143-155）

## P3（1 项）

- DataTable.test.tsx 断言 CSS 类 / data-slot / data-testid（:101-123,157-169），违反「只断言外部行为」

## 被认可的正面项（摘录）

- 转草稿主路径全程不弹窗；行级/批量 API body 与测试一致；批量 >5 篇警告生效
- ConfirmDialog 的 danger tone / submitting 禁用 / impacts 位置正确
- purge 状态机正确（失败保留弹窗可重试）
- 客户端分页保留 SWR 缓存、无整页刷新；PaginationBar 无残留
- AiTaskActivitySync 10s 与 fake timer 精确匹配；去抖确实减少 router.refresh
- --text-faint #64748b 仅 .admin-theme 作用域，未泄漏前台
- tablist roving tabindex 实现正确（方向键循环/Home/End/preventDefault）
- DataTable role=status 隐含 aria-live=polite；loading 优先于 emptyState
- MarkdownEditor UTF-16 选区在正常浏览器下无 emoji 偏移问题
- 面包屑 {label,href}[] + aria-current 正确
- AiNewsSourceFormDialog fieldset+legend 在 jsdom 下 role=group 查询成立

## 遗留与争议（需产品/维护者拍板）

- 全仓仍 3 处原生 window.confirm（useModelActions:103、useAiNewsSources:176/218）——本轮工单点名范围外，是否扩范围？
- DataTable 行号语义：全局序号 vs 当前页渲染序（产品文案定义）
- transition-all 是否算「装饰动效噪音」：计划只点名 pulse/translate/scale/glow/阴影
- 发布确认测试：hook 层 renderHook 测试保留，还是迁移到页面级 user-event 测试（Sol 建议后者）

---

## 修复状态（用户确认：P1 全部 + 高价值 P2）

| 项 | 状态 | 修复方式 |
|----|------|---------|
| P1-1 编辑器 Enter 隐式提交绕过确认 | ✅ | AdminPostWorkspace handleSubmit 增加 willPublish（intent===null && formData.published===true 也弹确认） |
| P1-2 ConfirmDialog 双击竞态 | ✅ | confirmLockRef 同步锁 + Promise.resolve 收尾释放 |
| P1-3 批量发布快照漂移 | ✅ | updateBulkPublish 增加 useFrozenIds 参数，确认后提交弹窗冻结 ids |
| P1-4 AdminPagination effect 内 setState | ✅ | 改渲染期条件调整（previousActivePageRef） |
| P1-5 发布确认测试缝 | ✅ 折中 | 保留 hook 契约测试 + 新增 PostsTable.publish-toggle.test.tsx（user-event 外部行为：点击触发回调、busy 禁用） |
| P1-6 BulkAiCompletionDialog 手写 fetch | ✅ | 改 apiMutate + toErrorMessage；测试 mock 兼容（断言不变） |
| P1-7 AdminGlobalSearch effect+eslint-disable | ✅ | 改渲染期条件调整（SSR 首帧 Ctrl K 一致，客户端切 ⌘K） |
| P2-1 GitHubBinding 手写 fetch+失败关弹窗 | ✅ | apiMutate + 失败返回 false 保持弹窗可重试 |
| P2-2 ai-news 日报失败关弹窗 | ✅ | runNewsGeneration 返回 Promise<boolean>，成功才关闭 |
| P2-3 通知未读重复播报 | ✅ | 角标/列表未读点 aria-hidden；未读状态并入菜单项 aria-label |
| P2-4 text-[10px] 残留×2 | ✅ | NotificationBell 角标、AiNewsSourceCard 选择钮 → text-xs（容器 h-6 w-6） |
| P2-5 Modal 无名 dialog | ✅ | 类型联合强制 title/ariaLabel 至少其一；删除无名 dialog 测试用例；全调用点已审计有 title |
| P2-6 DataTable 行号语义 | ⏸ 保留 | 全局序号（activePage-1）*pageSize+rowIndex 为既有语义，产品决策未改（测试已覆盖第 1 页） |
| P2-7 ai/interfaces 硬编码色 | ✅ | 4 处 emerald/amber → --success-*/--warning-* token |
| P2-8 TabsBar/Sider transition 残留 | ⏸ 保留 | 计划未点名 transition；过渡色/展开动画属状态反馈，见争议项 |
| P2-9 comments 错误/空态混淆 | ✅ | 解构 commentsError → 错误块（role=status + 重试按钮）；测试改断言错误文案且无「暂无评论」 |
| P2-10 日志测试 2100ms sleep | ✅ | renderLogsClient helper（SWRConfig Map 隔离）+ 删除真实等待 |
| P2-11 NotificationBell 错误收敛 | ✅ | markAllRead/openNotification 加 toast.error + toErrorMessage；错误行改语义色 |
| P3 DataTable.test 断言 CSS 类 | ⏸ 保留 | 布局契约测试（滚动/固定表头），属有意的少量契约断言 |
