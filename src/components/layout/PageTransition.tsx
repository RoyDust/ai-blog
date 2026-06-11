"use client";

import type { ReactNode } from "react";

/**
 * 路由切换过渡由 Next 的 View Transitions（experimental.viewTransition）承担，
 * 这里刻意保持透传：
 *
 * - AnimatePresence 的 initial={false} 会通过 presence 上下文禁用整个子树的
 *   入场动画（曾让文章页/系列页的所有 motion 入场失效，只有绕开本组件的
 *   首页幸免）；
 * - 任何用 opacity 隐藏已可见内容的路由动画都会复发 43df139 修过的
 *   缓存切换闪烁。
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
