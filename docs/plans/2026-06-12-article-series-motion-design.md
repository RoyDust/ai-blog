# 文章页 / 系列页动效优化设计方案

- 日期：2026-06-12
- 状态：待评审
- 范围：`(public)/posts/[slug]`、`(public)/series`、`(public)/series/[slug]`；复用 `src/components/motion` 现有基建，不新增动画库
- 原则：编辑型博客 MOTION 4 档——动效服务"内容渐次呈现"，不做炫技；只动 transform/opacity；`prefers-reduced-motion` 全部短路

## 1. 根因诊断（为什么首页好、文章页/系列页僵）

**首页好在哪**：AI 日报条与文章列表用 `stagger 60-70ms` 级联入场（`listContainerVariants`/`postCardRevealVariants`），卡片有 hover lift + 辉光，封面/标题带 view transition 跨页 morph——"有节奏、有反馈、有连续性"三样齐全。

**文章页僵的根因**（不是没动画，是动画放错了时机）：

1. **"加载即播"而不是"入视口播"**。`ArticleSectionsReveal` 对正文、相关文章、读后操作、Newsletter、评论五个 section 用 `animate="visible"` + `staggerChildren 0.11`——页面加载瞬间全部按时间表播完。但相关文章/评论都在首屏之外，用户滚下去时动画**早已结束**，看到的是静止内容。滚动全程零反馈 = 僵硬的主观来源。
2. **Hero 是一整块淡入**。`ArticleHero` 只有整体 `opacity 0→1`（0.82s），面包屑/分类 chip/标题/摘要/meta 行没有内部层次，与首页卡片的级联节奏断档。
3. 正文长内容无任何滚动伴随（这部分**保持不动是对的**，正文不该动，但上述 1、2 让"不动"显得是缺陷而非克制）。

**系列页僵的根因**（这次是真没动画）：

4. `/series` 列表与 `/series/[slug]` 详情都是纯服务端渲染，**零入场动效**：banner、统计徽章、卡片 grid 同帧砸出。全站唯二完全静态的公共页。
5. `SeriesCard` 与系列详情的文章列表**没有 view transition name**——从系列卡进详情、从详情进文章都是硬切，而 posts 流的封面/标题有跨页 morph。连续性断在系列这条线上。
6. `SeriesCard` hover 只有文字变色 + 箭头 0.5px 位移（卡片基类的 lift 有，但封面无 scale 视差感知弱）。

## 2. 方案

### A. 新增一个通用组件，修文章页时机问题（核心，约半天）

新增 `src/components/motion/InViewReveal.tsx`：

```tsx
// whileInView + viewport={{ once: true, amount: 0.2, margin: "0px 0px -8% 0px" }}
// variants 复用 revealVariants 节奏（y: 10→0, 0.6s outQuint）
// useReducedMotion 时与 ArticleSectionsReveal 相同的 reducedVariants 短路
```

文章页改造（`posts/[slug]/page.tsx`）：

- **首屏块**（article shell：hero+正文）保留现有 load 入场，但去掉外层 `staggerChildren`（首屏只有一个块，stagger 无意义且拖慢）。
- **视口外四个 section**（系列导航/相关文章、读后操作、Newsletter、评论）从 `ArticleSection` 换成 `InViewReveal`——滚到哪、亮到哪，每个 section 进入视口时单独上浮淡入。
- `ArticleSectionsReveal` 容器退化为纯布局 div（或仅包首屏）。

这是去僵硬的最大单点：滚动过程从"全程静止"变成"内容迎着你出现"。

### B. Hero 内部级联（约 2h）

`ArticleHero` 内部四层 stagger（70ms 间隔、与首页同一 ease）：

1. 面包屑 + 分类 chip（合并为第一拍）
2. H1 标题（带着已有的 view transition name，morph 完成后再做 8px 上浮会打架——**仅对无 morph 来源的直接访问播放**，用 `motion.div` 包内容层而非 h1 本身，避开 viewTransitionName 元素）
3. 摘要
4. meta 行（作者/日期/阅读量）

实现：hero 内容区套 `listContainerVariants`（staggerChildren 0.07），各层套 `revealVariants`。封面图保持现状（priority 图不加动画，保 LCP）。

### C. 系列线补全（约半天）

1. **`/series` 列表入场**：banner 套 `onload-animation`（与首页同款 CSS 入场）；卡片 grid 改用现成 `MotionList`（stagger 60ms + AnimatePresence，与 /posts 同节奏）。SeriesCard 需要的微调：封面挪进 `theme-media`（已有）确认 hover scale 生效。
2. **`/series/[slug]` 详情入场**：banner 同上；文章列表逐条 `InViewReveal`（列表可能 20+ 篇，超出首屏部分入视口再播，正好复用 A 的组件）。
3. **view transition 接线**（连续性的关键）：
   - `lib/view-transition.ts` 增加 `getSeriesViewTransitionName('cover'|'title', slug)`；
   - `SeriesCard` 封面与标题挂 name → `/series/[slug]` banner 与 H1 挂同名 → 卡片到详情产生 morph；
   - 系列详情的文章条目标题挂 `getPostViewTransitionName('title', slug)` → 进文章页与 Hero 标题 morph（posts 流已有该机制，纯复用）。
4. SeriesCard hover：箭头位移从 0.5px 提到 4px（`group-hover:translate-x-1`），与首页卡片箭头反馈对齐。

### D. 收尾一致性（约 1h）

- 自查清单：`(public)` 下所有列表页（posts/series/archives/categories/tags/search/guides/bookmarks）至少具备"入场 stagger 或 onload-animation"之一——目前只有 series 两页缺失，本方案补齐后归零。
- `motion/variants.ts` 不加新 variants，全部复用既有节奏，避免第二套时间体系。

## 3. 明确不做

- 正文段落/标题/图片的逐个 scroll reveal——长文阅读时频繁动效是干扰，正文保持静态是设计而非缺陷。
- GSAP / 滚动 pin / 视差——依赖里没有 GSAP，motion 足够，且编辑型博客不需要 scroll-hijack。
- 评论区内部逐条动画——列表可能很长，入场一次即可。

## 4. 验证标准

- [ ] 文章页：滚动到相关文章/评论时能看到入场动画（此前为静止）；首屏 LCP 无回归（封面图不参与动画）。
- [ ] 系列页：列表卡片 stagger 入场；系列卡 → 详情 banner 有 morph；详情文章条 → 文章页标题有 morph。
- [ ] `prefers-reduced-motion: reduce` 下所有新增动效短路（复用 reducedVariants 模式）。
- [ ] 既有契约测试全过（`ArticleSection` 改名/换实现需同步 `article-experience` 测试中的结构断言）。
- [ ] 明暗双主题 + 移动端 390px 实测滚动流畅，无 CLS。

## 5. 工作量与批次

| 批次 | 内容 | 预估 |
|---|---|---|
| M1 | InViewReveal 组件 + 文章页时机改造（A） | 0.5 天 |
| M2 | Hero 级联（B） | 2h |
| M3 | 系列线：入场 + view transition（C） | 0.5 天 |
| M4 | 一致性自查与测试同步（D） | 1h |

合计约 1.5 天。M1 独立可合；M3 依赖 M1 的组件但不依赖 M2。
