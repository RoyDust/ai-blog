# 衬线 Display 标题设计方案

- 日期：2026-06-11
- 状态：待评审（实施前需确认是否要衬线方向）
- 范围：公共阅读端 display 层级标题；不涉及后台、正文字体

## 1. 背景与动机

全站目前只有阿里巴巴普惠体（`--font-sans` = `--font-display` = Alibaba PuHuiTi），标题层级完全依赖字重（700/800）与字号区分。这能保证一致性，但"编辑部/杂志感"的高级氛围缺少字族对比这一最有效的手段。

taste-skill 准则对衬线的约束是：**默认禁用，仅当美学家族确实是 editorial / 出版物气质且能说清为什么时才允许**。本站定位"夜读杂志"（夜城背景 + 阅读室隐喻 + 札记文案），属于可以正当使用衬线 display 的场景。本方案给出落地路径，但**是否采纳由站主决断**——这是审美取舍而非缺陷修复。

## 2. 目标 / 非目标

**目标**

- 文章详情页 H1、首页/列表页 H1 等 display 层级使用中文衬线，建立"标题=刊物、正文=工具"的对比。
- 字体加载不劣化 LCP/CLS（中文字体体积是主要风险）。
- 暗色模式下衬线笔画细部仍清晰可读。

**非目标**

- 正文、UI 控件、后台一律不换字体。
- 不引入英文专用衬线（中文衬线自带的拉丁字形够用，避免双字体混排基线问题）。

## 3. 字体选型

| 候选 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| 思源宋体 Source Han Serif SC / Noto Serif SC | 开源、字重全（200–900）、显示效果稳定 | 全量 woff2 单字重约 8–10MB | **推荐** |
| 方正/汉仪商用衬线 | 个性更强 | 商用授权费 | 排除 |
| 霞鹜文楷 LXGW WenKai | 开源、有手写温度 | 偏"文楷"气质，与夜城科技感冲突 | 备选 |

推荐：**Noto Serif SC，仅 700（标题加粗）+ 900（超大 display）两个字重**。

## 4. 性能策略（关键约束）

中文字体不能全量加载。按优先级：

1. **预子集化（推荐）**：构建期用 `cn-font-split`（或 fonttools）把 Noto Serif SC 切成 unicode-range 分片 woff2，浏览器只按需下载命中分片（标题文字通常只命中 2–4 个分片，约 80–200KB）。产物放 `src/app/fonts/` 用 `next/font/local` 声明。
2. 降级方案：`next/font/google` 的 `Noto_Serif_SC`（Next 会做基础子集，但中文场景产物仍偏大）。
3. 兜底 `font-display: swap` + fallback 链 `"Noto Serif SC", "Source Han Serif SC", "SimSun", serif`，并用 `adjustFontFallback` 控制 CLS。

预算红线：标题字体首屏新增传输 ≤ 250KB，LCP 退化 ≤ 100ms（实测对比），CLS 增量 ≈ 0。

## 5. 接入设计

1. `src/app/fonts.ts` 新增 `serifDisplay` 声明，导出 `--font-serif-display` CSS 变量；root layout 的 `<html>` className 挂载变量。
2. `globals.css` 中 `--font-display` 从 `var(--font-alibaba-puhuiti)` 改为 `var(--font-serif-display)`；现有使用 `font-display` 工具类的位置（contact H1、ArticleHero H1 等）自动生效。
3. 扩大应用面（逐个评审，不一刀切）：
   - `ArticleHero` H1（最大收益位）
   - 首页 `reader-section-heading`？**先不动**——小字号衬线在暗色屏幕发虚，节标题保持黑体。
   - /posts、/series、/archives 等页面 H1：统一加 `font-display`。
4. 字重规则：display 衬线只用 700/900，禁用 400（细衬线在暗背景上发灰）。

## 6. 验收标准

- [ ] 文章页、列表页 H1 渲染为衬线，正文/导航/按钮不受影响。
- [ ] Lighthouse 移动端：LCP 与基线差 ≤ 100ms；CLS 无可见增量。
- [ ] 暗色模式下 1440/390 两档宽度截图评审：笔画无糊、无发灰。
- [ ] 切换网络为 Slow 3G：swap 期间 fallback 字形不引起明显跳动。
- [ ] vitest / lint 全过。

## 7. 风险与回退

- 风险：中文衬线在低分屏（1x DPR）小字号下发虚 → 已通过"只用于 ≥text-3xl 的 display 层级"规避。
- 风险：子集分片构建链路增加维护成本 → 分片脚本进 `scripts/`，README 记录再生成方式。
- 回退：`--font-display` 改回 `var(--font-alibaba-puhuiti)` 一行即可整体回退。

## 8. 工作量预估

字体子集化 + 接入 + 截图评审 + 性能对比 ≈ 0.5–1 天。
