"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, PanelLeft, PenLine } from "lucide-react";
import { useAdminLayout } from "./AdminLayoutContext";
import { AdminBreadcrumbs } from "./AdminBreadcrumbs";
import { getAdminPathMeta } from "./config";
import { NotificationBell } from "@/components/admin/notifications/NotificationBell";
import { AdminGlobalSearch } from "@/components/admin/shell/AdminGlobalSearch";

export function AdminHeader(props: { siteName?: string } = {}) {
  void props;
  const pathname = usePathname();
  const {
    isCollapsed,
    setIsCollapsed,
    isMobileViewport,
    isMobileDrawerOpen,
    toggleMobileDrawer,
  } = useAdminLayout();
  const pathMeta = getAdminPathMeta(pathname);

  const toggleLabel = isMobileViewport
    ? isMobileDrawerOpen
      ? "关闭导航菜单"
      : "打开导航菜单"
    : isCollapsed
      ? "展开侧边栏"
      : "收起侧边栏";

  const handleToggleNavigation = () => {
    if (isMobileViewport) {
      toggleMobileDrawer();
      return;
    }
    setIsCollapsed(!isCollapsed);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 transition-colors duration-200 lg:px-5">
      <div className="flex h-10 w-full items-center justify-between gap-2 sm:gap-3">
        <div className="flex shrink-0 items-center gap-2.5 lg:min-w-0">
          <button
            aria-controls={isMobileViewport ? "admin-mobile-drawer" : undefined}
            aria-expanded={isMobileViewport ? isMobileDrawerOpen : undefined}
            aria-label={toggleLabel}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[var(--muted)] transition-colors duration-150 hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
            onClick={handleToggleNavigation}
            type="button"
          >
            {isMobileViewport ? (
              <Menu aria-hidden="true" className="h-4.5 w-4.5" />
            ) : (
              <PanelLeft aria-hidden="true" className="h-4 w-4" />
            )}
          </button>

          <div className="hidden overflow-hidden text-ellipsis whitespace-nowrap md:block">
            <AdminBreadcrumbs items={pathMeta.crumbs} />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-2.5 lg:flex-none">
          <AdminGlobalSearch />

          <Link
            aria-label="新建文章"
            className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-control)] bg-[var(--btn-regular-bg)] px-2.5 text-xs font-semibold text-[var(--btn-content)] transition-colors duration-150 hover:bg-[var(--btn-regular-bg-hover)] sm:px-3"
            href="/admin/posts/new"
          >
            <PenLine className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">新建文章</span>
          </Link>

          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
