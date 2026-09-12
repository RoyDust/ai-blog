# 后台首页信息层级重构 — 实施计划

- 日期：2026-06-11
- 设计文档：[2026-06-11-admin-dashboard-hierarchy-design.md](./2026-06-11-admin-dashboard-hierarchy-design.md)
- 建议顺序：在《前后台视觉统一》B1–B2 之后实施（同文件冲突最小化）；若先行，徽章/按钮一律沿用现状 token，不引入新视觉
- 预估总量：1–1.5 天，D1–D4 四批

## 代码基线（2026-06-11 实测）

- `src/app/admin/page.tsx`：已有 `getDraftQueue()`(take 3)、`getPendingCommentQueue()`(take 3)、`getPopularPosts(range)`、AI 模型清单（`getPublicAiModelOptions`）、`PanelMetaPill` 等局部组件。
- `src/lib/admin-stats.ts` 导出：`parseAdminStatsRange` / `getAdminStatsRangeWindow` / `getVisitTrendStats` / `getReadingStats` / `getEngagementStats` / `getDashboardStats`（聚合前三者，无环比）。
- 状态常量：AI 任务失败态 = `AI_TASK_STATUSES.failed`/`partialFailed`（`src/lib/ai-tasks.ts`，status 为 String 字段）；Newsletter 状态机 = `DRAFT | SENDING | SENT | PARTIAL_FAILED | FAILED`。

## D1 数据层（约 0.5 天）

- [ ] 1.1 `src/lib/admin-stats.ts` 新增 `getAdminTodoCounts(now = new Date())`：
  ```ts
  // 返回 { pendingComments, failedAiTasks, staleDrafts, pendingNewsletters }
  // 四个 count 用 Promise.all 并发：
  // pendingComments:    comment.count({ where: { deletedAt: null, status: "PENDING" } })
  // failedAiTasks:      aiTask.count({ where: { status: { in: [AI_TASK_STATUSES.failed, AI_TASK_STATUSES.partialFailed] },
  //                                            finishedAt: { gte: now-7d } } })   // 只看近 7 天，避免历史失败永久挂待办
  // staleDrafts:        post.count({ where: { deletedAt: null, published: false, updatedAt: { lt: now-7d } } })
  // pendingNewsletters: newsletterCampaign.count({ where: { status: { in: ["DRAFT", "PARTIAL_FAILED", "FAILED"] } } })
  ```
  常量从 `@/lib/ai-tasks` 导入，不重复字面量；7 天窗口提成模块常量。
- [ ] 1.2 环比：新增 `getDashboardStatsWithComparison(rangeInput, now)` —— 内部调两次现有聚合（当前窗口 + `getAdminStatsRangeWindow` 平移一个窗口），输出 `{ current: DashboardStats, deltas: { visits, readingMinutes, engagementRate, subscribers } }`。**不改 `getDashboardStats` 签名**，既有契约测试零波及。
- [ ] 1.3 单测 `src/lib/__tests__/admin-stats-todo.test.ts`（对齐现有 admin-stats 测试的 prisma mock 风格）：
  - 四计数的 where 条件断言（特别是 failedAiTasks 的 status in + 时间窗）；
  - 全零路径；
  - 环比窗口平移正确（当前 7d → 对比前一个 7d）。
- [ ] 验证：`pnpm vitest run src/lib/__tests__` 全过。

## D2 待办条组件（约 2h）

- [ ] 2.1 新建 `src/components/admin/dashboard/AdminTodoStrip.tsx`：
  - props：`{ counts: AdminTodoCounts }`；
  - 四项配置化：`[{ key, label: "待审评论", count, href: "/admin/comments?status=PENDING", icon }, …]`，链接分别指向评论审核、AI 任务中心、文章工作台（草稿筛选）、newsletter；**先核对各目标页实际支持的 query 参数，不存在的筛选参数不要拍脑袋写**；
  - count > 0 的项用 danger/warning 语义色徽章，= 0 的项不渲染；
  - 全部为 0：整条收起为一行"今日无待办 ✓"（成功语义色、无卡片边框）；
  - 每项 `aria-label="待审评论 3 条，点击进入评论审核"`。
- [ ] 2.2 组件测试 `__tests__/AdminTodoStrip.test.tsx`：有待办（链接 href 与计数渲染）/全零（收起行）两态 + aria-label 断言。
- [ ] 验证：`pnpm vitest run src/components/admin/dashboard`。

## D3 首页重排（约 0.5 天）

- [ ] 3.1 `src/app/admin/page.tsx` 数据装配：`Promise.all` 增加 `getAdminTodoCounts()`，`getDashboardStats` 替换为 `getDashboardStatsWithComparison`。
- [ ] 3.2 页面结构改为三层：
  - **L1**：`<AdminTodoStrip>` 置顶，页面唯一品牌色强调区；
  - **L2**：四指标数字行（7 日发布数、阅读时长、互动率、订阅净增 + 环比小箭头），无卡片边框、`divide-x` + `tabular-nums`，数据取自 comparison 结果；
  - **L3**：访问/互动趋势图（现状保留）、热门文章 Top5、草稿队列、待审评论明细（L1 点击可锚点跳到此处，`id="pending-comments"` 等）。
- [ ] 3.3 AI 模型清单移出首页：区块删除；在 L1 增加条件项"可用 AI 模型为 0"（`getPublicAiModelOptions()` 为空时显示，href `/admin/ai`）。
- [ ] 3.4 动效降级：dashboard 范围内的 `WorkspacePanel` 入场动画移除——给 `WorkspacePanel` 加 `reveal?: boolean = true` prop，首页全部传 `reveal={false}`，其他页面零影响。
- [ ] 3.5 标题层级：L3 区块标题降一级字号；首页品牌色强调收敛到 L1 + "新建文章"主按钮两处。
- [ ] 验证：
  - `pnpm vitest run src/app/admin src/components/admin`（既有首页契约测试若断言被移除区块需同步调整，调整理由写进提交正文）；
  - 截图 1440×900：L1 全部待办 + L2 四指标首屏可见、无需滚动；
  - 制造数据验证两态：有待办（手工把一条评论置 PENDING）与全零。

## D4 可达性与文案（约 2h）

- [ ] 4.1 键盘走查：Tab 顺序 L1 → L2 → L3，待办项 focus ring 可见。
- [ ] 4.2 L1 各项 aria-label 复核（含计数与目的地）；L2 数字行加 `aria-label` 描述指标含义与环比。
- [ ] 4.3 文案终审：无英文 kicker、无感叹号、环比箭头有文字等价物（如"较上期 +12%"）。
- [ ] 4.4 全量收尾：`pnpm vitest run`、`pnpm lint`、`pnpm build`；`tasks/todo.md` 记录；设计文档状态改"已实施"。

## 提交切分

D1 一个 commit（`feat: 后台待办与环比聚合查询`）、D2+D3 一个（`feat: 后台首页改为待办优先三层结构`）、D4 并入 D3 或单独 `fix:`。D1 可先行合并（纯新增，无 UI 变化）。

## 风险登记

| 风险 | 缓解 |
|---|---|
| "待办优先"押注错误（站主更想先看数据） | L1/L2 是兄弟区块，对调顺序为 10 分钟改动；先发版收集使用反馈 |
| 环比双窗口聚合拖慢首页 | 首页已 `force-dynamic`；若实测 > 300ms，对比窗口聚合降级为仅 count 类轻查询，或加 `unstable_cache` 短缓存 |
| 失败 AI 任务历史积压导致 L1 常红 | 已用 7 天窗口约束；另在 AI 任务中心提供"忽略"操作属后续迭代，不在本计划 |
| 既有首页契约测试断言被删区块 | 调整测试时在提交正文逐条说明删除理由，避免静默放宽 |
