# 前后台视觉系统统一设计方案

- 日期：2026-06-11
- 状态：待评审
- 来源：impeccable 评审（2026-06-08）P1-2 "公共博客和后台工作台视觉系统断裂"
- 范围：design token 层与后台壳层/高频页面；不改任何页面布局与功能

## 1. 现状诊断

两套互不相认的视觉系统并存：

| 维度 | 前台 reader | 后台 admin |
|---|---|---|
| 主色 | `--brand` = oklch 动态色相（用户可调 `--hue`） | `--vben-primary: #0960bd` 固定蓝 |
| 暗色侧栏 | 夜城玻璃深蓝 | Vben `#001529` / `#151515` 硬编码 |
| 圆角 | 1.5rem 卡 / 0.65rem 控件 | rounded-md/lg/xl 混用 |
| badge | reader-chip（描边+低饱和填充） | StatusBadge + 多处任意值蓝胶囊 |
| focus ring | `--ring`（随 hue） | `color-mix(--vben-primary 30%)` |
| 阴影 | 染色阴影（背景同色相） | 近黑低透明度通用阴影 |

后果：从"阅读"切到"管理"像进入另一个产品；`--hue` 主题色个性化在后台完全失效；同名 token（`--brand`、`--ring`）在两个皮肤下语义漂移。

涉及面：`src/styles/theme-variables.css` 的 `.admin-theme` 两段（光/暗）约 120 行；`src/components/admin/**` 与 `src/app/admin/**` 中残留的任意值类（`blue-50`、`slate-500`、`#0960bd` 衍生 color-mix 等）。

## 2. 设计原则

**"一套品牌，两种场景皮肤"**——保留"阅读室 vs 工作台"的氛围差（密度、留白、玻璃感），统一品牌身份（色相、状态色、focus、radius 阶、字体）。

具体不变项：admin 信息密度、表格布局、侧栏结构。
具体统一项：

1. **色相同源**：废除 `--vben-primary` 固定蓝，admin 的 `--brand` 改为 `oklch(L C var(--hue))` 形式（L/C 取比 reader 更稳重的档位），用户调 hue 前后台同步换装。
2. **侧栏换肤**：`#001529` → `oklch(0.16 0.03 var(--hue))` 一类同源深色；hover/active/border 全部由 color-mix 派生，不再有独立 `--vben-sidebar-*` 字面量。
3. **radius 阶**：定义全局 `--radius-control: 0.65rem`、`--radius-panel: 1rem`、`--radius-card: 1.5rem`（reader 用 card 档，admin 用 panel 档），淘汰散落的 rounded-md/lg/xl。
4. **状态色共享**：danger/success/warning 两套定义合并为一套（admin 现有的 `#e11d48` 等字面量改 token）。
5. **focus ring 共享**：admin `--ring` 直接复用根定义。

## 3. Token 重组方案

`theme-variables.css` 重组为三段：

```
:root            → 品牌基底（--hue、状态色、radius 阶、focus、字体）+ reader 皮肤
:root.dark       → reader 暗色覆写
.admin-theme     → 工作台皮肤：仅覆写 surface/密度/阴影 + brand 的 L/C 档位
.dark .admin-theme → 工作台暗色覆写
```

命名迁移：`--vben-*` → `--admin-sidebar-*`（且值全部由品牌基底派生）。保留旧名一个过渡版本（alias 指向新值），全部组件迁完后删除。

## 4. 实施批次（每批独立可合并、可回退）

| 批次 | 内容 | 验证 |
|---|---|---|
| B1 | token 重组 + alias 过渡；admin `--brand`/`--ring`/状态色接入品牌基底 | 契约测试 + admin 全区截图 diff，预期仅色相微移 |
| B2 | 后台壳层（AdminSidebar / AdminHeader / footer）替换 `--vben-*` 引用 | 截图 + 调 `--hue` 验证侧栏跟随 |
| B3 | 高频页（dashboard、posts 工作台）清理任意值蓝/灰类 → semantic token | `rg 'blue-\d|slate-\d|#0960bd' src/app/admin src/components/admin` 归零（白名单除外） |
| B4 | 长尾页（ai、ai-news、newsletter、logs、settings…）同 B3 | 同上 + impeccable detector |
| B5 | 删除 `--vben-*` alias | 全量 vitest / lint / build |

## 5. 验收标准

- [ ] 调整 `--hue`（HuePicker）时，admin 侧栏、主按钮、badge、focus ring 与前台同步变化。
- [ ] `rg '--vben-' src/` 归零；admin 目录任意值色彩类归零（图表色板等白名单注释豁免）。
- [ ] danger/success/warning 在前后台是同一组 token。
- [ ] impeccable CLI detector 无 gray-on-color / 任意蓝胶囊类报告。
- [ ] 既有契约测试与 e2e 全过；后台所有区块光/暗截图无布局回归。

## 6. 风险

- admin 页面广（14 个区），一次性替换易漏 → 分批 + grep 审计兜底。
- Vben 蓝是部分用户的"后台认知锚" → B1 先只动 token 不动观感档位，色相跟随 `--hue` 默认值（224）时与现状接近，感知是渐变不是断裂。
- 图表（recharts）颜色独立配置 → 单列白名单，B4 统一从 token 读色。

## 7. 工作量预估

B1–B2 约 1 天；B3–B5 约 1.5–2 天（以页面数量为主）。可与日常迭代并行，批间无依赖死锁。
