# 前后台视觉系统统一 — 实施计划

- 日期：2026-06-11
- 设计文档：[2026-06-11-admin-reader-visual-unification-design.md](./2026-06-11-admin-reader-visual-unification-design.md)
- 预估总量：2.5–3 天，B1–B5 五批，每批独立提交、独立可回退

## 现状审计基线（2026-06-11 实测）

| 项 | 数量 | 位置 |
|---|---|---|
| `--vben-*` 引用 | 44 处 / 2 文件 | `src/styles/theme-variables.css`(26)、`src/components/admin/shell/AdminSider.tsx`(18) |
| 任意值色彩类（blue/slate/sky/indigo-NNN） | 96 处 / 8 文件 | `src/app/admin/`：posts/page(61)、comments(5)、series(18)、newsletter(3)、首页(3)、AdminAnalyticsCharts(2)、topic-guides(2)、ai/interfaces(2) |
| 同上 | 81 处 / 8 文件 | `src/components/admin/`：logs(24)、DataTable(18)、AiTaskList(15)、AiTaskDetail(14)、AdminSider(6)、AdminTabsBar(2)、notifications(2) |

审计命令（每批结束后重跑，作为退出标准）：

```
Grep pattern: --vben-                          → 目标最终为 0
Grep pattern: \b(blue|slate|sky|indigo)-\d{2,3}\b  路径 src/app/admin 与 src/components/admin → 目标 0（白名单除外）
```

白名单（豁免并注释 `/* token-audit-allow */`）：recharts 图表色板（若 B3 无法 token 化）。

## B1 Token 重组（约 0.5 天）

- [ ] 1.1 `src/styles/theme-variables.css` 顶部新增**品牌基底**块（reader/admin 共享）：
  ```css
  :root {
    /* 既有 --hue 保持 */
    --radius-control: 0.65rem;
    --radius-panel: 1rem;
    --radius-card: 1.5rem;
  }
  ```
  状态色（danger/success/warning 三组 surface/border/foreground）保留 `:root` 与 `:root.dark` 的现有定义为共享源。
- [ ] 1.2 `.admin-theme` 改造：
  - `--primary`/`--brand`：`#0960bd` → `oklch(0.52 0.10 var(--hue))`；`--brand-strong` → `oklch(0.46 0.11 var(--hue))`；
  - `--ring`：改为复用根定义（删除本地 color-mix 版本）；
  - 状态色：删除 `.admin-theme` 内的 `#e11d48`/`#16a34a`/`#d97706` 等字面量组，落到共享源（亮度档位若需微调，用 color-mix 基于共享 token 派生）；
  - 新增 `--admin-sidebar-bg: oklch(0.16 0.03 var(--hue))` 及 text/muted/hover/border/active/active-bg 全套（由 bg 和 brand color-mix 派生）。
- [ ] 1.3 `.dark .admin-theme` 同步：sidebar 深色档、brand 提亮档（`oklch(0.62 0.10 var(--hue))`）。
- [ ] 1.4 **alias 过渡**：`--vben-primary: var(--brand)` 等旧名全部指向新值，组件零改动先通过。
- [ ] 验证：
  - `pnpm vitest run src/components/admin src/app/admin`（含 admin-layout 契约测试）；
  - 截图 `/admin`、`/admin/posts` 光/暗各一张与基线对比——默认 `--hue: 224` 下应只有色相微移，无布局变化；
  - `pnpm lint`。

## B2 壳层迁移（约 0.5 天）

- [ ] 2.1 `AdminSider.tsx`：18 处 `--vben-sidebar-*` → `--admin-sidebar-*`；6 处任意值色类 → semantic token。
- [ ] 2.2 `AdminHeader.tsx`、`AdminTabsBar.tsx`(2)、`AdminBreadcrumbs.tsx`：清任意值色；主操作按钮 hover 上浮效果改为稳定反馈（评审遗留项：背景加深，不位移）。
- [ ] 2.3 圆角接 radius 阶：壳层容器 `--radius-panel`、控件 `--radius-control`。
- [ ] 验证：
  - 手动调 HuePicker 改 `--hue`，侧栏/active 态/主按钮跟随变色（录屏或两档截图）；
  - `pnpm vitest run src/components/admin/__tests__/admin-layout.test.tsx`；
  - Grep 审计：AdminSider/Header/TabsBar 三文件任意值色与 `--vben-` 归零。

## B3 高频页迁移（约 0.5–1 天）

迁移规则（B3/B4 通用）：
- `bg-blue-50 text-blue-600` 这类信息徽章 → `StatusBadge` 或 `color-mix(in oklab, var(--brand) N%, ...)`；
- `text-slate-500/400` → `var(--text-muted)` / `var(--text-faint)`；
- `border-slate-200` → `var(--border)`；
- 表头/分组底 `bg-slate-50` → `var(--surface-alt)`。

- [ ] 3.1 `src/app/admin/posts/page.tsx`（61 处，最大单文件）：按上表逐处替换；批量操作工具栏、状态徽章统一走 `StatusBadge`。
- [ ] 3.2 `src/components/admin/DataTable.tsx`（18 处）：表头、斑马纹、hover 行底色 token 化（影响所有表格页，改完抽查 3 个使用方）。
- [ ] 3.3 `src/app/admin/page.tsx`(3) + `AdminAnalyticsCharts.tsx`(2)：图表色尝试从 CSS 变量读取（`getComputedStyle` 或图表配置引用 token 值）；不可行则加白名单注释。
- [ ] 验证：
  - `pnpm vitest run`（全量，DataTable 影响面大）；
  - `/admin/posts` 截图：筛选、选中态、批量工具栏、分页逐个核对；
  - Grep 审计：posts/page、DataTable 归零。

## B4 长尾页迁移（约 0.5–1 天）

- [ ] 4.1 `components/admin/logs/ApiOperationLogsClient.tsx`（24）
- [ ] 4.2 `components/admin/ai/AiTaskList.tsx`（15）、`AiTaskDetail.tsx`（14）
- [ ] 4.3 `app/admin/series/page.tsx`（18）、`comments/page.tsx`（5）、`newsletter/page.tsx`（3）、`topic-guides/page.tsx`（2）、`ai/interfaces/page.tsx`（2）
- [ ] 4.4 `components/admin/notifications/*`（2）
- [ ] 验证：每改完一组跑对应 `__tests__`；全部完成后 Grep 审计两目录归零（白名单除外）；impeccable CLI detector 重跑（`.agents/skills/impeccable/scripts`），确认无 gray-on-color 报告。

## B5 收尾删除 alias（约 1h）

- [ ] 5.1 删除 theme-variables.css 中全部 `--vben-*` alias；`Grep "--vben-"` 全仓归零。
- [ ] 5.2 全量验证：`pnpm vitest run`、`pnpm lint`、`pnpm build`。
- [ ] 5.3 后台全部 14 个分区人工过一遍光/暗主题（dashboard / posts / categories / tags / series / comments / covers / ai / ai-news / newsletter / notifications / logs / settings / taxonomy / topic-guides）。
- [ ] 5.4 提交收尾：`tasks/todo.md` 记录、设计文档状态改"已实施"。

## 批次提交与回退

每批一个 commit（`refactor: 后台视觉 token 统一 B1-token 基底` …）。回退单位 = 批次 commit revert：B1 含 alias 故 revert B2–B4 任一批不会破坏其余批次；B5 必须最后、且仅在 B2–B4 审计归零后执行。

## 风险登记

| 风险 | 缓解 |
|---|---|
| posts/page.tsx 61 处替换引入视觉回归 | 改前先截基线图，逐区块对照；该页已有契约测试兜底交互 |
| 用户对后台"蓝色锚点"不适 | B1 的 brand L/C 档位在 hue=224 时与 #0960bd 视觉接近；如反馈强烈仅需调 `.admin-theme` 两个数值 |
| recharts 无法读 CSS 变量 | 图表组件挂载时 `getComputedStyle(document.documentElement).getPropertyValue('--brand')` 注入；仍不行走白名单 |
