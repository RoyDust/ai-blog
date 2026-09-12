# 衬线 Display 标题 — 实施计划

- 日期：2026-06-11
- 设计文档：[2026-06-11-serif-display-typography-design.md](./2026-06-11-serif-display-typography-design.md)
- 前置条件：**P0 站主确认采用衬线方向后才开工**（这是审美取舍，不是缺陷修复）
- 预估总量：0.5–1 天

## P0 决策闸（人工）

- [ ] 站主确认：display 层级采用 Noto Serif SC（700/900）；否则本计划终止，文档标记 rejected。

## P1 字体资产（约 2h）

- [ ] 1.1 获取 Noto Serif SC 的 700、900 两个字重源文件（官方 OTF/TTF）。
- [ ] 1.2 用 `cn-font-split` 做 unicode-range 子集化，产物输出到 `public/font/noto-serif-sc/`：
  ```bash
  npx cn-font-split -i NotoSerifSC-Bold.otf  -o public/font/noto-serif-sc/700
  npx cn-font-split -i NotoSerifSC-Black.otf -o public/font/noto-serif-sc/900
  ```
  产物含分片 woff2 + `result.css`（内含按 unicode-range 的 @font-face 组）。
- [ ] 1.3 把两份 `result.css` 合并整理为 `src/styles/font-serif-display.css`：
  - `font-family` 统一命名 `"Noto Serif SC Display"`；
  - 每条 @font-face 带 `font-display: swap`；
  - 路径改为 `/font/noto-serif-sc/...` 绝对引用。
- [ ] 1.4 新建 `scripts/README-display-font.md` 记录：源文件版本、cn-font-split 版本与命令，保证可再生成。
- [ ] 验证：`Get-ChildItem public/font/noto-serif-sc -Recurse | Measure-Object Length -Sum` 记录总体积；抽查单分片 < 100KB。

**注**：子集化方案下不用 `next/font/local`（它不支持成百分片声明），改用纯 CSS @font-face + unicode-range，浏览器按需拉取。`fonts.ts` 不动。

## P2 接入 token（约 1h）

- [ ] 2.1 `src/app/globals.css`：
  - `@import` 或在入口引入 `font-serif-display.css`（确认现有样式引入方式后对齐，Tailwind v4 用 `@import "../styles/font-serif-display.css";`）；
  - `--font-display` 从 `var(--font-alibaba-puhuiti)` 改为：
    ```css
    --font-display: "Noto Serif SC Display", var(--font-alibaba-puhuiti), "Source Han Serif SC", serif;
    ```
- [ ] 2.2 确认 `.admin-theme` 不受影响：admin 不使用 `font-display` 工具类（grep `font-display` in src/app/admin、src/components/admin，若有命中需先豁免）。
- [ ] 验证：`pnpm dev` 后文章页 H1 computed font-family 命中 "Noto Serif SC Display"。

## P3 应用面收敛（约 1.5h）

- [ ] 3.1 盘点现有 `font-display` 类的使用位置：`Grep "font-display" src/`，逐个确认都是 display 层级（已知：ArticleHero H1、contact H1 等）。
- [ ] 3.2 给以下页面 H1 补 `font-display`（统一 `text-3xl md:text-4xl tracking-tight` 节奏）：
  - `src/app/(public)/posts/page.tsx`（全部文章）
  - `src/app/(public)/series/page.tsx`、`archives`、`categories`、`tags`、`search`、`guides`、`about` 各页 H1
- [ ] 3.3 明确**不动**项并在 PR 描述记录：`reader-section-heading`（小字号衬线发虚）、正文 prose、导航、按钮、admin 全部。
- [ ] 3.4 字重审计：display 衬线只允许 `font-bold`(700)/`font-black`(900)；grep 应用位置确认无 400/500 衬线。
- [ ] 验证：`pnpm vitest run` 全过（页面快照类契约测试若断言 className 需同步更新）。

## P4 性能与视觉验证（约 1.5h）

- [ ] 4.1 基线对比：改动前后各跑一次 Lighthouse 移动端（文章详情页 + 首页），记录 LCP/CLS。红线：LCP 增幅 ≤ 100ms，CLS 增量 ≈ 0。
- [ ] 4.2 DevTools Network 过滤 font：打开文章页记录分片命中数与传输量，红线 ≤ 250KB。
- [ ] 4.3 Slow 3G 模拟：swap 阶段 fallback（普惠体）→ 衬线切换无明显布局跳动；若跳动明显，在 @font-face 增加 `size-adjust` 校正。
- [ ] 4.4 截图评审 4 张：文章页 + /posts，暗/明两主题，1440 与 390 两档；重点看暗色下笔画是否发灰。
- [ ] 4.5 `pnpm lint`、`pnpm build` 通过。

## P5 收尾

- [ ] 5.1 `tasks/todo.md` 记录结果；提交信息 `feat: 接入衬线 display 标题`，trailer 注明 `Reversibility: globals.css 一行回退`。
- [ ] 5.2 回退预案验证：注释掉 2.1 的 `--font-display` 改动一行，确认整站回到普惠体。

## 风险与中止条件

| 触发 | 动作 |
|---|---|
| 4.1 LCP 超红线 | 检查分片是否被 preload 污染；只对 H1 命中分片做 `<link rel=preload>`；仍超则中止并回退 |
| 4.4 暗色发虚 | 字重升到 900 重试；仍虚则中止 |
| cn-font-split 产物异常字形 | 退回备选方案 `next/font/google` 的 `Noto_Serif_SC`（接受体积劣化，重测 4.1/4.2） |
