"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, PenLine } from "lucide-react";
import { useAdminLayout } from "./AdminLayoutContext";
import { AdminBreadcrumbs } from "./AdminBreadcrumbs";
import { getAdminPathMeta } from "./config";
import { NotificationBell } from "@/components/admin/notifications/NotificationBell";
import { AdminGlobalSearch } from "@/components/admin/shell/AdminGlobalSearch";

export function AdminHeader() {
  const pathname = usePathname();
  const { isCollapsed, setIsCollapsed } = useAdminLayout();
  const pathMeta = getAdminPathMeta(pathname);

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 lg:px-6 transition-all duration-200">
      <div className="flex h-11 w-full items-center justify-between gap-4">
        {/* Left Side: Collapse Button & Breadcrumbs */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="rounded-lg p-2 hover:bg-[var(--surface-alt)] text-[var(--muted)] hover:text-[var(--foreground)] transition-colors duration-150"
            aria-label={isCollapsed ? "展开侧边栏" : "收起侧边栏"}
            type="button"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden md:block overflow-hidden text-ellipsis whitespace-nowrap">
            <AdminBreadcrumbs items={pathMeta.crumbs} />
          </div>
        </div>

        {/* Right Side: Global Search & Quick Actions */}
        <div className="flex shrink-0 items-center gap-3">
          <AdminGlobalSearch />

          <Link
            className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg bg-[var(--brand)] px-3.5 text-xs font-semibold text-white shadow-sm shadow-blue-500/10 transition-all duration-200 hover:bg-[var(--brand-strong)] hover:-translate-y-0.5 hover:shadow-md active:translate-y-0"
            href="/admin/posts/new"
          >
            <PenLine className="h-3.5 w-3.5" />
            <span>新建文章</span>
          </Link>

          <NotificationBell />
        </div>
      </div>
    </header>
  );
}
