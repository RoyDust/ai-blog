"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useAdminLayout } from "./AdminLayoutContext";
import { AdminBreadcrumbs } from "./AdminBreadcrumbs";
import { getAdminPathMeta } from "./config";
import { NotificationBell } from "@/components/admin/notifications/NotificationBell";
import { AdminGlobalSearch } from "@/components/admin/shell/AdminGlobalSearch";
import { adminIconButtonClassName } from "@/components/admin/primitives/admin-classes";
import { buttonVariants } from "@/components/admin/ui";
import { cn } from "@/lib/cn";

/**
 * 顶栏（方向 A）：68px，左侧收起按钮 + 「/」分隔面包屑，右侧 1px 描边搜索入口 + 描边「新建文章」+ 通知铃。
 * 「新建文章」降为描边按钮，把实心主按钮留给页面内容。
 */
export function AdminHeader() {
  const pathname = usePathname();
  const { isCollapsed, setIsCollapsed } = useAdminLayout();
  const pathMeta = getAdminPathMeta(pathname);
  const CollapseIcon = isCollapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <header className="sticky top-0 z-30 flex h-[68px] shrink-0 items-center gap-2.5 border-b border-[var(--reader-border)] bg-[var(--card-bg)] pr-4 pl-3.5 lg:pr-6">
      <button
        aria-label={isCollapsed ? "展开侧边栏" : "收起侧边栏"}
        className={adminIconButtonClassName}
        onClick={() => setIsCollapsed(!isCollapsed)}
        type="button"
      >
        <CollapseIcon aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
      </button>

      <div className="hidden min-w-0 overflow-hidden md:block">
        <AdminBreadcrumbs items={pathMeta.crumbs} />
      </div>

      <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2.5">
        <AdminGlobalSearch />

        {/* 文章列表页的页头已有「新建文章」，顶栏这一个隐藏，避免同屏两个入口（README 第 14 节） */}
        {pathname === "/admin/posts" ? null : (
          <Link className={cn(buttonVariants({ variant: "outline" }), "hidden px-3.5 sm:inline-flex")} href="/admin/posts/new">
            新建文章
          </Link>
        )}

        <NotificationBell />
      </div>
    </header>
  );
}
