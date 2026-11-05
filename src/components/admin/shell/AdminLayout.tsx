"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { editorialEase } from "@/components/editorial";
import { AdminHeader } from "./AdminHeader";
import { AdminSider } from "./AdminSider";
import { AdminLayoutProvider, useAdminLayout } from "./AdminLayoutContext";
import { AdminTabsBar } from "./AdminTabsBar";

interface AdminLayoutProps {
  children: ReactNode;
  siteName?: string;
  user: {
    email?: string | null;
    image?: string | null;
    label: string;
    role?: string | null;
  };
}

export function AdminLayout({ children, siteName = "My Blog", user }: AdminLayoutProps) {
  return (
    <AdminLayoutProvider>
      <AdminLayoutContent siteName={siteName} user={user}>
        {children}
      </AdminLayoutContent>
    </AdminLayoutProvider>
  );
}

/**
 * 后台外壳（方向 A，原型 13）：224px 深色侧栏（收起 64px）| 68px 顶栏 + 44px 标签栏 + 内容区。
 *
 * 内容区：页面底色上放一张纸面（card-bg、1px 描边、6px 圆角、无阴影，内边距 28px 32px），
 * 每个后台页面都直接写在这张纸面里，不要再自己套面板或卡片。版权页脚放在纸面底部。
 * 固定高度路由（文章列表、接口日志、文章编辑）纸面撑满视口，由页面内部滚动，不放页脚。
 */
function AdminLayoutContent({ children, siteName, user }: { children: ReactNode; siteName: string; user: AdminLayoutProps["user"] }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const { isCollapsed } = useAdminLayout();
  const isPostEditorRoute = /^\/admin\/posts\/(?:new|[^/]+\/edit)\/?$/.test(pathname);
  const isScrollLockedRoute = isPostEditorRoute || pathname === "/admin/posts" || pathname === "/admin/logs";

  const rootClassName = isScrollLockedRoute
    ? "admin-theme fixed inset-0 h-dvh overflow-hidden bg-[var(--page-bg)] text-[var(--text-body)] antialiased"
    : "admin-theme h-screen overflow-hidden bg-[var(--page-bg)] text-[var(--text-body)] antialiased";

  // 收起 / 展开：网格列宽与侧栏宽度一起过渡（减少动态效果时直接切换）
  const gridColumnsClassName = isCollapsed ? "lg:grid-cols-[64px_minmax(0,1fr)]" : "lg:grid-cols-[224px_minmax(0,1fr)]";
  const gridTransitionClassName =
    "transition-[grid-template-columns] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none";

  const gridClassName = isScrollLockedRoute
    ? `grid h-full min-h-0 overflow-hidden ${gridTransitionClassName} ${gridColumnsClassName}`
    : `grid h-screen ${gridTransitionClassName} ${gridColumnsClassName}`;

  const layoutContentClassName = isScrollLockedRoute
    ? "min-w-0 flex h-full min-h-0 flex-col overflow-hidden"
    : "min-w-0 h-screen overflow-hidden flex flex-col";

  const mainClassName = isScrollLockedRoute
    ? "flex-1 min-h-0 w-full overflow-hidden p-3 lg:p-5"
    : "flex-1 w-full overflow-y-auto p-3 lg:p-5";

  // 纸面：唯一的大容器
  const paperClassName =
    "rounded-[var(--radius-paper)] border border-[var(--reader-border)] bg-[var(--card-bg)] px-4 sm:px-6 lg:px-8";
  const contentClassName = isScrollLockedRoute
    ? `mx-auto h-full min-h-0 w-full max-w-[1840px] overflow-hidden py-5 lg:py-7 ${paperClassName}`
    : `mx-auto flex min-h-full w-full max-w-[1840px] flex-col pt-5 lg:pt-7 ${paperClassName}`;

  return (
    <div className={rootClassName}>
      <div className={gridClassName} data-layout-sidebar-width={isCollapsed ? "64" : "224"} data-testid="admin-layout-grid">
        <AdminSider pathname={pathname} siteName={siteName} user={user} />
        <div className={layoutContentClassName} data-testid="admin-layout-content">
          <AdminHeader />
          <AdminTabsBar />
          <main className={mainClassName} data-content-max-width="full" data-testid="admin-layout-main">
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className={contentClassName}
              data-slot="admin-paper"
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              transition={{ duration: 0.36, ease: editorialEase }}
            >
              {isScrollLockedRoute ? (
                children
              ) : (
                <>
                  <div className="min-w-0 flex-1">{children}</div>
                  <AdminFooter siteName={siteName} />
                </>
              )}
            </motion.div>
          </main>
        </div>
      </div>
    </div>
  );
}

/** 纸面底部页脚：版权一行 + 等宽「版本 · 全局搜索」 */
function AdminFooter({ siteName }: { siteName: string }) {
  return (
    <footer className="mt-9 flex flex-wrap justify-between gap-x-4 gap-y-1 border-t border-[var(--border)] pt-4 pb-5 text-xs text-[var(--text-muted)]">
      <span>© 2024 {siteName} · 记录与分享技术、生活与思考。</span>
      <span className="ed-mono">版本 1.0.0 · Ctrl+K 全局搜索</span>
    </footer>
  );
}
