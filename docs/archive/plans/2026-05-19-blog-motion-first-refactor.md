# 博客 Motion-first 动效改造实施文档

日期：2026-05-19

关联文档：

- `docs/plans/2026-05-19-blog-animation-refactor-options.md`

## 决策结论

本次改造采用 **Motion-first** 策略：凡是与 React 状态、组件进入/退出、列表重排、滚动进度、导航状态、按钮反馈、轮播切换相关的动效，优先使用 Motion for React（原 Framer Motion）。

但这不是 Motion-only。以下能力仍保留 CSS：

- 主题变量、颜色系统、伪元素、全局背景。
- `:hover` / `:focus-visible` 的基础颜色和边框过渡。
- 骨架屏 shimmer。
- Markdown 正文排版。
- 全局 `prefers-reduced-motion` 兜底。

原因是 Next.js App Router 下 Server Component 和 Client Component 边界必须清楚。强行把所有视觉过渡都迁移到 Motion，会把大量本来可服务端渲染的组件变成客户端组件，收益不稳定。

## 设计目标

动效风格：夜景阅读、安静、精致、低干扰。

核心原则：

1. Motion 用来表达状态变化和空间关系，不做装饰性乱动。
2. 首页可以有编排感，文章详情页要服务阅读。
3. 交互反馈要快，按钮类反馈控制在 120-180ms。
4. 页面级入场要克制，首屏总编排不超过 650ms。
5. 所有 Motion 动效默认尊重 `prefers-reduced-motion`。
6. 避免把 Markdown 正文每个段落包成 motion component。

## 技术基础

### 依赖

安装 Motion：

```bash
pnpm add motion
```

官方导入方式：

```tsx
import { motion, AnimatePresence, MotionConfig, LayoutGroup } from "motion/react";
import { useScroll, useSpring, useTransform, useMotionValueEvent } from "motion/react";
import { stagger } from "motion/react";
```

### 全局 Provider

新增：

- `src/components/motion/BlogMotionProvider.tsx`
- `src/components/motion/transitions.ts`
- `src/components/motion/index.ts`

接入点：

- `src/components/AppProviders.tsx`

建议结构：

```tsx
"use client";

import { MotionConfig } from "motion/react";
import { blogMotionTransition } from "./transitions";

export function BlogMotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={blogMotionTransition}>
      {children}
    </MotionConfig>
  );
}
```

在 `AppProviders` 中包裹 `ThemeProvider` 内部内容：

```tsx
<ThemeProvider>
  <BlogMotionProvider>
    {children}
    ...
  </BlogMotionProvider>
</ThemeProvider>
```

`MotionConfig reducedMotion="user"` 遵循用户系统设置。减少动效开启时，Motion 自动禁用 transform 和 layout 动画，但 opacity、backgroundColor 等仍可保留淡入淡出。

## Motion Token

新增 `src/components/motion/transitions.ts`：

```ts
// ── Easing curves ────────────────────────────────────────────────────────────
export const motionEase = {
  outQuart: [0.25, 1, 0.5, 1] as const,
  outQuint: [0.22, 1, 0.36, 1] as const,
  outExpo:  [0.16, 1, 0.3, 1] as const,
};

// ── Duration tokens (tween) ──────────────────────────────────────────────────
export const motionDuration = {
  tap:      0.12,
  fast:     0.18,
  base:     0.24,
  panel:    0.28,
  entrance: 0.42,
};

// ── Spring tokens ─────────────────────────────────────────────────────────────
// 使用 visualDuration + bounce，比手调 stiffness/damping 更直觉，
// 且便于与 tween 动画在时间轴上对齐（官方推荐做法）。
export const springSnappy = {
  type: "spring",
  visualDuration: 0.2,
  bounce: 0.2,
} as const;

export const springGentle = {
  type: "spring",
  visualDuration: 0.35,
  bounce: 0.1,
} as const;

// 用于 useSpring：适合 ReadingProgress 和拖拽类场景
export const springScroll = {
  stiffness: 200,
  damping: 40,
  mass: 0.8,
} as const;

// ── Global default transition ────────────────────────────────────────────────
export const blogMotionTransition = {
  duration: motionDuration.base,
  ease: motionEase.outQuint,
};

// ── Preset transitions ────────────────────────────────────────────────────────
export const revealTransition = {
  duration: motionDuration.entrance,
  ease: motionEase.outQuint,
};

export const panelTransition = {
  duration: motionDuration.panel,
  ease: motionEase.outQuint,
};
```

CSS 侧仍保留对应变量，给非 Motion 动画和全局兜底使用：

- `--motion-duration-fast`
- `--motion-duration-base`
- `--motion-duration-panel`
- `--ease-out-quint`

## Variants 系统

Motion Variants 是让编排逻辑集中、可复用的关键。把分散的 `initial/animate/exit` 内联对象提升为命名变量，组件侧只引用名称。

新增 `src/components/motion/variants.ts`：

```ts
import { Variants } from "motion/react";
import { motionEase, motionDuration } from "./transitions";

// ── 入场 reveal ───────────────────────────────────────────────────────────────
export const revealVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: motionDuration.entrance, ease: motionEase.outQuint } },
  exit:   { opacity: 0, y: -4, transition: { duration: motionDuration.fast, ease: motionEase.outQuart } },
};

// ── 列表容器（stagger 编排）────────────────────────────────────────────────────
// 官方推荐在 parent variants 里统一设定 staggerChildren，
// 子项引用 revealVariants.hidden / .visible，由 parent 控制节奏。
export const listContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0,
    },
  },
};

// ── 面板（菜单、主题设置、搜索浮层）──────────────────────────────────────────
export const panelVariants: Variants = {
  hidden: { opacity: 0, scale: 0.97, y: -6 },
  visible: { opacity: 1, scale: 1, y: 0 },
  exit:   { opacity: 0, scale: 0.97, y: -6 },
};

// ── 底部面板（移动菜单从底部上滑）──────────────────────────────────────────
export const sheetVariants: Variants = {
  hidden:  { opacity: 0, y: "100%" },
  visible: { opacity: 1, y: 0 },
  exit:    { opacity: 0, y: "100%" },
};

// ── 内容替换（轮播、tab 切换）────────────────────────────────────────────────
export const cross-fadeVariants: Variants = {
  hidden:  { opacity: 0, scale: 0.99 },
  visible: { opacity: 1, scale: 1 },
  exit:    { opacity: 0, scale: 1.01 },
};

// ── 反馈 icon（点赞/收藏 icon key 切换）─────────────────────────────────────
export const iconPopVariants: Variants = {
  hidden:  { scale: 0.8, opacity: 0 },
  visible: { scale: 1, opacity: 1, transition: { type: "spring", visualDuration: 0.2, bounce: 0.35 } },
};
```

## Motion 基础组件

### MotionReveal

用途：替换当前 `.onload-animation` 和 `getListRevealAnimationProps` 的多数使用。

建议文件：`src/components/motion/MotionReveal.tsx`

能力：

- 支持 `delayIndex`（通过 CSS variable 方式或 `delay` prop）
- 支持 `className` 透传
- reduced motion 下只做 opacity 或直接显示
- 默认只做 `opacity + y: 8`，量极小

建议 API：

```tsx
"use client";

import { motion } from "motion/react";
import { revealVariants } from "./variants";
import { motionDuration } from "./transitions";

interface MotionRevealProps {
  children: React.ReactNode;
  delayIndex?: number;
  className?: string;
}

export function MotionReveal({ children, delayIndex = 0, className }: MotionRevealProps) {
  return (
    <motion.div
      className={className}
      variants={revealVariants}
      initial="hidden"
      animate="visible"
      transition={{ delay: delayIndex * 0.06 }}
    >
      {children}
    </motion.div>
  );
}
```

> **注意**：如果父容器已用 `listContainerVariants` 做编排，子项直接 `variants={revealVariants}` 而不传 `initial/animate`，由父亲控制入场节奏。两种用法不要混用。

### MotionList

用途：列表首屏、无限滚动追加、筛选结果变化。

建议文件：`src/components/motion/MotionList.tsx`

核心要点：

- 父容器用 `listContainerVariants` 驱动 `staggerChildren`
- 子项用 `revealVariants`
- 筛选变化时用 `AnimatePresence mode="popLayout"`：退出项立即移出文档流，周围元素立刻回流，视觉最干净
- `initial={false}` 放在 `AnimatePresence` 上，防止已存在的列表项在路由进入时重播入场动画
- 每项必须使用稳定的 `key`（`post.id`），不能用数组 index

```tsx
"use client";

import { motion, AnimatePresence } from "motion/react";
import { listContainerVariants, revealVariants } from "./variants";

interface MotionListProps<T> {
  items: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => React.ReactNode;
}

export function MotionList<T>({ items, getKey, renderItem }: MotionListProps<T>) {
  return (
    <motion.ul
      variants={listContainerVariants}
      initial="hidden"
      animate="visible"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {items.map((item) => (
          <motion.li
            key={getKey(item)}
            layout
            variants={revealVariants}
          >
            {renderItem(item)}
          </motion.li>
        ))}
      </AnimatePresence>
    </motion.ul>
  );
}
```

### MotionIconButton

用途：点赞、收藏、分享、复制、返回顶部、主题设置、移动菜单按钮。

建议文件：`src/components/motion/MotionIconButton.tsx`

核心要点：

- `whileTap={{ scale: 0.92 }}` 快速手感
- `whileHover={{ y: -1 }}` 轻微上浮，感知即可
- `whileFocus` 与 `whileTap` 保持一致，确保键盘操作有和鼠标点击相同的视觉反馈（官方文档说明 `whileTap` 的 `Enter` 键触发支持）
- reduced motion 下 transform 类手势自动被 MotionConfig 禁用

```tsx
"use client";

import { motion } from "motion/react";
import { springSnappy } from "./transitions";

type MotionIconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export function MotionIconButton({ children, ...props }: MotionIconButtonProps) {
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.92 }}
      whileFocus={{ scale: 0.96 }}
      transition={springSnappy}
      {...props}
    >
      {children}
    </motion.button>
  );
}
```

不要把按钮样式迁移到这个组件里，只封装 Motion 行为，原有 className 和 aria 属性完整透传。

### MotionPanel

用途：移动导航菜单、主题面板、搜索浮层。

建议文件：`src/components/motion/MotionPanel.tsx`

核心要点：

- `AnimatePresence` 包裹，保证 exit 动画完成后才从 DOM 移除
- `panelVariants` 提供 scale + opacity + y 的联合动效，比纯 opacity 有空间感
- 焦点管理和 `aria-hidden/tabIndex` 逻辑保留在调用方，不放在这里

```tsx
"use client";

import { motion, AnimatePresence } from "motion/react";
import { panelVariants } from "./variants";
import { panelTransition } from "./transitions";

interface MotionPanelProps {
  open: boolean;
  children: React.ReactNode;
  className?: string;
}

export function MotionPanel({ open, children, className }: MotionPanelProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={className}
          variants={panelVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={panelTransition}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
```

## 组件改造清单

| 文件 | 改造方式 | 目标 |
| --- | --- | --- |
| `src/components/AppProviders.tsx` | 接入 `BlogMotionProvider` | 全站 Motion 配置统一 |
| `src/styles/animations.css` | 保留 reduced motion 和少量 CSS keyframes | 兜底，不再作为主入场系统 |
| `src/components/blog/listAnimation.ts` | 废弃或改为 compatibility wrapper | 列表 reveal 交给 `MotionReveal` |
| `src/components/blog/ReadingProgress.tsx` | `useScroll` + `useSpring` + `motion.div` `scaleX` | 弹性跟随感，绕过 React re-render |
| `src/components/blog/BackToTopButton.tsx` | 滚动阈值显示，`AnimatePresence` 进出 | 不再常驻遮挡 |
| `src/components/layout/Navbar.tsx` | active underline 用 `layoutId` + `LayoutGroup`，移动菜单用 `MotionPanel` | 导航状态更顺滑 |
| `src/components/ui/HuePicker.tsx` | 用 `MotionPanel` 管理开关 | 主题面板进出一致 |
| `src/components/blog/HomeAiDailyStrip.tsx` | strip 项目 reveal + hover/tap | 首页首屏有节奏 |
| `src/components/blog/HomeLatestPosts.tsx` | 卡片列表用 `MotionList` + `listContainerVariants` stagger | 替换 delay style |
| `src/components/blog/PostsListingClient.tsx` | `AnimatePresence mode="popLayout"` + `layout` | 筛选/追加更自然 |
| `src/components/blog/PostCard.tsx` | 外层 wrapper `motion.div layout`，cover hover 用 `whileHover` | 卡片布局变化统一 |
| `src/components/blog/PostCardFeatured.tsx` | 外层 wrapper `motion.div layout` | 精选卡片重排自然 |
| `src/components/blog/PostCardSecondary.tsx` | 外层 wrapper `motion.div layout` | 次级卡片一致 |
| `src/components/blog/HomeReaderBanner.tsx` | `AnimatePresence mode="wait"` + `cross-fadeVariants` + `custom` 方向控制 | 替换瞬时切换 |
| `src/components/blog/LikeButton.tsx` | `MotionIconButton` + icon key animation + `iconPopVariants` | 点赞状态反馈 |
| `src/components/blog/BookmarkButton.tsx` | `MotionIconButton` + icon key animation | 收藏状态反馈 |
| `src/components/blog/ShareButton.tsx` | copied 状态 `AnimatePresence` | 分享复制反馈 |
| `src/components/blog/CopyCodeButton.tsx` | copied/failed 状态切换动画 | 代码复制反馈 |
| `src/components/blog/ArticleToc.tsx` | active marker 用 `layoutId` | 目录定位反馈 |
| `src/components/blog/ArticleContinuation.tsx` | 上/下一篇卡片 `whileHover`/`whileTap` | 阅读末尾动作增强 |
| `src/components/blog/NewsletterForm.tsx` | 提交、成功、错误状态动画 | 表单反馈明确 |

> **PostCard 注意**：PostCard 当前是 Server Component。直接加 `motion.article` 会让它变 client。推荐新增 `MotionPostCardShell` 做 client 包装层，卡片业务逻辑保持 RSC，只在外层增加运动行为。

## 分阶段实施计划

### Phase 0：依赖与 Provider

目标：引入 Motion，但不改变 UI 行为。

任务：

- 安装 `motion`。
- 新增 `BlogMotionProvider`。
- 新增 `transitions.ts` 和 `variants.ts`。
- 在 `AppProviders` 中接入。
- 保留现有 CSS 动效，避免一次性行为变化。

验证：

```bash
rtk pnpm lint
pnpm test -- src/components/__tests__/app-providers-contract.test.tsx
rtk pnpm build
```

### Phase 1：底层 Motion primitives

目标：先建可复用基础件，避免每个组件手写 variants。

任务：

- 新增 `MotionReveal`。
- 新增 `MotionList`。
- 新增 `MotionIconButton`。
- 新增 `MotionPanel`。
- 给 primitives 写组件测试。

验收标准：

- reduced motion 下 transform 类动画禁用或降级。
- primitives 不吞掉 `aria-*`、`data-*`、`className`、`children`。
- 不引入新的视觉样式，只提供运动行为。
- `MotionIconButton` 的 `whileFocus` 在键盘 Tab 聚焦时触发，与鼠标 hover 视觉一致。

验证：

```bash
rtk pnpm test -- src/components/motion
rtk pnpm lint
```

### Phase 2：阅读基础交互

目标：优先改低风险、高收益组件。

任务：

- `ReadingProgress` 改用 `useScroll` + `useSpring`。
- `BackToTopButton` 增加出现/退出动画。
- `LikeButton`、`BookmarkButton`、`ShareButton`、`CopyCodeButton` 改成 Motion 状态反馈。

实现要点：

- `ReadingProgress` 的 `scaleX` 通过 `useSpring(scrollYProgress, springScroll)` 得到，进度条会平滑跟随滚动而不是每帧突变，同时完全绕过 React re-render（Motion Value 直接更新 DOM）。
- `BackToTopButton` 监听滚动阈值，用 `useMotionValueEvent` 替代 `useEffect + setState`，避免每次滚动触发组件重渲染。
- 点赞/收藏失败回滚逻辑不变，Motion 不参与业务状态判断。

验证：

```bash
rtk pnpm test -- src/components/blog/__tests__
rtk pnpm lint
```

### Phase 3：导航和面板

目标：把显著的状态切换交给 Motion。

任务：

- `Navbar` 导航链接用 `LayoutGroup` 包裹，active link 下方用 `layoutId="reader-nav-active-indicator"`。
- 移动菜单使用 `AnimatePresence` + `MotionPanel`。
- `HuePicker` 使用 `MotionPanel`。
- 保留滚动隐藏导航，但 transition 使用 Motion token。

验收标准：

- 移动菜单关闭后菜单链接不可 tab 聚焦（`aria-hidden`、`tabIndex=-1` 保留）。
- active indicator 不造成布局抖动（`layoutId` 使用 CSS transform，不触发 reflow）。
- sticky nav 和 sidebar `--sidebar-sticky-top` 逻辑不回退。

验证：

```bash
rtk pnpm test -- src/components/layout/__tests__/navbar-behavior.test.tsx
rtk pnpm test -- src/components/layout/__tests__/public-chrome.test.tsx
rtk pnpm lint
```

### Phase 4：首页和文章列表

目标：首页与列表成为 Motion-first 的主体验区域。

任务：

- `HomeAiDailyStrip` 使用 `MotionReveal`。
- `HomeLatestPosts` 使用 `MotionList`（`listContainerVariants` stagger）。
- `PostsListingClient` 使用 `AnimatePresence mode="popLayout"` + 子项 `layout`。
- `PostCard`、`PostCardFeatured`、`PostCardSecondary` 通过外层 wrapper 动画，不直接修改 RSC 组件本体。
- `HomeReaderBanner` 轮播使用 `AnimatePresence mode="wait"` + `cross-fadeVariants`。

轮播策略：

- 使用 `custom` prop 传入方向（+1/-1），配合 `usePresenceData()` 让 exit 动画根据方向决定偏移方向，实现有意图的滑入滑出，而不是随机 cross-fade。
- 自动播放保留，但 reduced motion 下停用自动播放或只做无位移切换。
- 指示器宽度变化保留 CSS，active 状态可用 layout indicator。

列表策略：

- 首屏前 4-6 项通过 `listContainerVariants` 的 `staggerChildren: 0.06` 自动编排，无需手动 delayIndex。
- 无限滚动追加项设 `initial={false}` 淡入（不重播 stagger），不做大范围 y 位移。
- 筛选变化时 `mode="popLayout"` 保证退出项立即移出文档流，入场项做 `opacity + y 6` 进入。

验证：

```bash
rtk pnpm test -- src/components/blog/__tests__/PostsListingClient.test.tsx
rtk pnpm test -- src/components/blog/__tests__/PostCard.test.tsx
rtk pnpm test -- src/components/blog/__tests__/PostCardFeatured.test.tsx
rtk pnpm test -- src/app/__tests__/home-reader-flow.test.tsx
rtk pnpm lint
```

### Phase 5：文章详情页局部增强
w
目标：文章页只增强辅助操作，不干扰正文阅读。

任务：

- `ArticleHero` 首屏淡入，不做正文段落逐段动画。
- `ArticleToc` active marker 使用 `layoutId`（加 `LayoutGroup` 包裹链接组以协调 layout 检测）。
- `ArticleContinuation` 使用 Motion hover/tap。
- `NewsletterForm` 提交状态、成功、错误状态增加 Motion feedback。

禁止：

- 禁止 Markdown 段落逐段 `whileInView`。
- 禁止正文图片滚动视差。
- 禁止目录栏整体跟随滚动做大位移。

验证：

```bash
rtk pnpm test -- "src/app/posts/[slug]/__tests__/article-experience.test.tsx"
rtk pnpm test -- "src/app/posts/[slug]/__tests__/article-dark-markdown-contract.test.tsx"
rtk pnpm lint
```

### Phase 6：清理旧 CSS 动效入口

目标：收敛到 Motion-first。

任务：

- 移除不再使用的 `.onload-animation` 调用。
- `listAnimation.ts` 若无兼容需求则删除。
- 保留 `animations.css` 中的 reduced motion 和必要 keyframes。
- 搜索 `transition-all`，替换为明确属性或 Motion 行为。

验证：

```bash
rg -n "onload-animation|stagger-children|transition-all|getListRevealAnimationProps" src
rtk pnpm lint
rtk pnpm test
rtk pnpm build
```

## 具体实现样例

### ReadingProgress（useSpring 弹性版）

```tsx
"use client";

import { motion, useScroll, useSpring } from "motion/react";
import { springScroll } from "@/components/motion/transitions";

export function ReadingProgress() {
  const { scrollYProgress } = useScroll();
  // useSpring 把 scrollYProgress 包成物理弹簧值：
  // 快速滚动时进度条追得上，停下时有轻微惯性收尾，质感明显优于直接 scaleX。
  // 整个链路不经过 React render，性能零代价。
  const scaleX = useSpring(scrollYProgress, springScroll);

  return (
    <div
      aria-label="阅读进度"
      className="fixed left-0 top-0 z-50 h-0.5 w-full bg-transparent"
      role="progressbar"
    >
      <motion.div
        className="h-full origin-left bg-[var(--accent-warm)] shadow-[0_0_12px_color-mix(in_oklab,var(--accent-warm)_50%,transparent)]"
        style={{ scaleX }}
      />
    </div>
  );
}
```

### BackToTopButton（useMotionValueEvent 版）

```tsx
"use client";

import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "motion/react";
import { useState } from "react";

export function BackToTopButton() {
  const { scrollY } = useScroll();
  const [visible, setVisible] = useState(false);

  // useMotionValueEvent 在 motion value 变化时触发，不触发组件 re-render，
  // 比 useEffect + addEventListener 更 Motion-native。
  useMotionValueEvent(scrollY, "change", (latest) => {
    setVisible(latest > 400);
  });

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="返回顶部"
        >
          ↑
        </motion.button>
      )}
    </AnimatePresence>
  );
}
```

### Navbar active indicator（LayoutGroup 版）

```tsx
import { motion, LayoutGroup } from "motion/react";

// LayoutGroup 确保当多个导航链接同时存在时，
// layout 变化检测跨组件同步，active indicator 移动不会出现跳跃。
<LayoutGroup id="reader-nav">
  {links.map((link) => (
    <NavLink key={link.href} link={link} />
  ))}
</LayoutGroup>

// 在 NavLink 内部：
{isActive && (
  <motion.span
    layoutId="reader-nav-active-indicator"
    className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-[var(--accent-sky)]"
  />
)}
```

原有 `after:` active underline 要移除，避免双下划线。

### 列表 stagger（Variants 编排版）

```tsx
import { motion, AnimatePresence } from "motion/react";
import { listContainerVariants, revealVariants } from "@/components/motion/variants";

<motion.div
  variants={listContainerVariants}
  initial="hidden"
  animate="visible"
>
  <AnimatePresence mode="popLayout" initial={false}>
    {posts.map((post) => (
      <motion.div
        key={post.id}
        layout
        variants={revealVariants}
      >
        <PostCard post={post} />
      </motion.div>
    ))}
  </AnimatePresence>
</motion.div>
```

`mode="popLayout"` 让被删除/筛掉的卡片立即脱离文档流，周围卡片即时回流，不会有"空洞等待"的视觉问题。

### 点赞按钮反馈（icon key animation 版）

```tsx
import { motion } from "motion/react";
import { springSnappy } from "@/components/motion/transitions";
import { iconPopVariants } from "@/components/motion/variants";

<motion.button
  whileTap={{ scale: 0.88 }}
  whileFocus={{ scale: 0.94 }}
  transition={springSnappy}
  onClick={handleLike}
  aria-pressed={liked}
>
  {/* key 变化驱动 icon 做一次 pop 动画，表达状态切换 */}
  <motion.span
    key={liked ? "liked" : "idle"}
    variants={iconPopVariants}
    initial="hidden"
    animate="visible"
  >
    <Heart
      className="h-4 w-4"
      fill={liked ? "currentColor" : "none"}
    />
  </motion.span>
</motion.button>
```

### 轮播 cross-fade（custom 方向控制版）

```tsx
import { motion, AnimatePresence } from "motion/react";

// custom 传入方向，exit 动画可以根据方向决定偏移，避免所有切换都向同一方向消失
const variants = {
  hidden:  (dir: number) => ({ opacity: 0, x: dir * 12, scale: 0.99 }),
  visible: { opacity: 1, x: 0, scale: 1 },
  exit:    (dir: number) => ({ opacity: 0, x: dir * -12, scale: 1.01 }),
};

<AnimatePresence mode="wait" custom={direction}>
  <motion.div
    key={currentIndex}
    custom={direction}
    variants={variants}
    initial="hidden"
    animate="visible"
    exit="exit"
    transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
  >
    <BannerSlide slide={slides[currentIndex]} />
  </motion.div>
</AnimatePresence>
```

## Reduced Motion 策略

全局：

- `MotionConfig reducedMotion="user"`：Motion 自动禁用 transform 和 layout 动画，opacity/color 保留。
- `src/styles/animations.css` 保留 `@media (prefers-reduced-motion: reduce)` 作为 CSS 侧兜底。

组件级降级：

- **轮播**：reduced motion 下停用自动轮播，保留手动切换（`cross-fadeVariants` 会被 MotionConfig 自动降级为纯 opacity）。
- **列表 stagger**：reduced motion 下 y 位移被禁用，只保留 opacity 渐入。
- **返回顶部**：reduced motion 下禁用 smooth scroll（`scrollTo({ top: 0 })`，不传 `behavior`）。
- **导航 active indicator**：layout transform 由 Motion 自动降级，只做 opacity 过渡。
- **骨架 shimmer**：CSS 中继续禁用 animation，与 Motion 无关。
- **ReadingProgress**：`useSpring` 的弹性效果在 reduced motion 下被 MotionConfig 降级为直接跟随。

测试 reduced motion：

```ts
await page.emulateMedia({ reducedMotion: "reduce" });
```

## 保留 CSS 的范围

以下不要迁移到 Motion：

- `reader-shell` 背景层、渐隐层、网格覆盖层。
- `reader-card::before`、`post-card--text-only::before` 伪元素。
- `theme-media::after` 覆盖层。
- typography、prose、code highlight。
- 简单 `color` / `border-color` hover（CSS 更轻，无需 client 化）。
- skeleton shimmer。
- Radix/shadcn 内置弹层动效，除非前台明确需要统一。

## 风险与防线

### 风险：Client Component 扩散

防线：

- Server page 不直接 import `motion/react`。
- 只在已经是 client 的组件，或新建局部 client wrapper 中使用 Motion。
- 新增 `MotionPostCardShell` 包一层，卡片业务组件保持 RSC。
- 首页和列表页先用外层 wrapper 动画，只有确实需要 `whileHover` 或内部状态动画时，再迁移卡片本体。

### 风险：布局动画和图片加载冲突

防线：

- 卡片封面固定 aspect ratio，防止图片加载时触发意外的 layout 重算。
- 列表项使用稳定 key（`post.id`，不用 index）。
- `layout` 只加在列表 item 外层，不在每个内部节点滥用。
- 有滚动容器的列表加 `layoutScroll`，防止 layout 动画因滚动偏移计算错误。

### 风险：动画过多影响阅读

防线：

- 文章详情页正文不做 scroll reveal 或 whileInView。
- 只动画辅助控件和文章头部。
- 目录 active marker 低调处理（短距离 layoutId 移动，非大幅飞入）。

### 风险：测试不稳定

防线：

- 测试环境优先开启 reduced motion（`vi.mock` 或 `page.emulateMedia`）。
- 视觉截图等待动画结束，首屏等待 700ms。
- 对 state 测试不要断言过渡中间帧。
- `AnimatePresence` 的 exit 动画完成后再断言 DOM 已移除（用 `waitForElementToBeRemoved`）。

### 风险：Motion Value 事件泄漏

防线：

- 使用 `useMotionValueEvent` 而非手动 `.on()` 订阅，前者会在组件卸载时自动清理。
- 不要在 `useEffect` 外部直接 `.on()` 订阅 motion value。

## 验收清单

- [ ] `motion` 已安装，lockfile 更新。
- [ ] `BlogMotionProvider` 已接入 `AppProviders`。
- [ ] `transitions.ts` 和 `variants.ts` 已建立，包含 spring token。
- [ ] 所有 Motion primitives 有测试。
- [ ] `ReadingProgress` 使用 `useSpring`，不通过 width 或 setState 驱动。
- [ ] `BackToTopButton` 使用 `useMotionValueEvent`，不在每次滚动触发 re-render。
- [ ] `Navbar` active indicator 使用 `layoutId` + `LayoutGroup`。
- [ ] 移动菜单有 exit 动画，关闭后不可 tab 聚焦。
- [ ] 首页列表使用 `listContainerVariants` stagger，无需手写 delayIndex。
- [ ] 文章列表筛选使用 `AnimatePresence mode="popLayout"`。
- [ ] 点赞、收藏、分享、复制有 icon key 动画状态反馈。
- [ ] `MotionIconButton` 的 `whileFocus` 键盘聚焦时有视觉反馈。
- [ ] 轮播 exit 方向与切换方向一致（custom 传方向）。
- [ ] reduced motion 下无大位移、无自动轮播、无 smooth scroll。
- [ ] `rg` 搜索确认旧 `.onload-animation` 使用范围被收敛。
- [ ] `/`、`/posts`、`/posts/[slug]` 桌面和移动端截图无溢出。
- [ ] `pnpm lint` 通过。
- [ ] `pnpm test` 通过。
- [ ] `pnpm build` 通过。
- [ ] `pnpm test:e2e -- e2e/reader.spec.ts` 通过或记录明确阻塞。

## 推荐执行顺序

1. Phase 0 + Phase 1 一起做：先接依赖和 primitives（含 `variants.ts`）。
2. Phase 2 做阅读基础交互：`useSpring` 进度条和 `useMotionValueEvent` 返回顶部收益最明显。
3. Phase 3 做导航：`LayoutGroup` + `layoutId` active indicator 是质感提升最直接的体现。
4. Phase 4 做首页和列表：`listContainerVariants` stagger 和 `popLayout` 是 Motion-first 的核心落点。
5. Phase 5 做文章详情页辅助动效。
6. Phase 6 清理旧 CSS 动画入口和 `transition-all`。

## 官方参考

- Motion for React 总览：<https://motion.dev/docs/react>
- MotionConfig：<https://motion.dev/docs/react-motion-config>
- AnimatePresence：<https://motion.dev/docs/react-animate-presence>
- Layout animations：<https://motion.dev/docs/react-layout-animations>
- Gestures（whileHover/whileTap/whileFocus）：<https://motion.dev/docs/react-gestures>
- useScroll：<https://motion.dev/docs/react-use-scroll>
- Motion Values（useMotionValue/useSpring/useTransform）：<https://motion.dev/docs/react-motion-value>
- Transitions（spring/tween/stagger）：<https://motion.dev/docs/react-transitions>
- Accessibility（reduced motion）：<https://motion.dev/docs/react-accessibility>
