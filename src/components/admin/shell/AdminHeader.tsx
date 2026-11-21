"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, PanelLeft, PenLine, X } from "lucide-react";
import { useAdminLayout } from "./AdminLayoutContext";
import { AdminBreadcrumbs } from "./AdminBreadcrumbs";
import { adminNavItems, getAdminPathMeta, isAdminNavItemActive } from "./config";
import { NotificationBell } from "@/components/admin/notifications/NotificationBell";
import { AdminGlobalSearch } from "@/components/admin/shell/AdminGlobalSearch";

export function AdminHeader({ siteName = "My Blog" }: { siteName?: string }) {
  const pathname = usePathname();
  const { isCollapsed, setIsCollapsed } = useAdminLayout();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathMeta = getAdminPathMeta(pathname);

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 lg:px-5 transition-colors duration-200">
      <div className="flex h-10 w-full items-center justify-between gap-2 sm:gap-3">
        {/* Left Side: Mobile Drawer / Desktop Collapse & Breadcrumbs */}
        <div className="flex shrink-0 items-center gap-2.5 lg:min-w-0">
          <Dialog.Root open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
            <Dialog.Trigger asChild>
              <button
                aria-label="打开移动端导航"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[var(--muted)] transition-colors hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)] lg:hidden"
                type="button"
              >
                <Menu className="h-4.5 w-4.5" />
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-black/35 backdrop-blur-xs lg:hidden" />
              <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-xl focus:outline-none lg:hidden">
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
                  <Dialog.Title className="truncate text-sm font-bold text-[var(--foreground)]">
                    {siteName}
                  </Dialog.Title>
                  <Dialog.Description className="sr-only">移动端后台菜单导航</Dialog.Description>
                  <Dialog.Close
                    aria-label="关闭移动端导航"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
                  >
                    <X className="h-4 w-4" />
                  </Dialog.Close>
                </div>
                <nav aria-label="移动端后台导航" className="mt-3 flex-1 space-y-1 overflow-y-auto">
                  {adminNavItems
                    .filter((item) => !item.disabled)
                    .map((item) => {
                      const Icon = item.icon;
                      const active = isAdminNavItemActive(pathname, item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setMobileNavOpen(false)}
                          className={`flex items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-2 text-[13px] font-medium transition-colors ${
                            active
                              ? "bg-[var(--btn-regular-bg)] font-semibold text-[var(--btn-content)]"
                              : "text-[var(--text-body)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                </nav>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[var(--muted)] transition-colors duration-150 hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)] lg:inline-flex"
            aria-label={isCollapsed ? "展开侧边栏" : "收起侧边栏"}
            type="button"
          >
            <PanelLeft className="h-4 w-4" />
          </button>

          <div className="hidden md:block overflow-hidden text-ellipsis whitespace-nowrap">
            <AdminBreadcrumbs items={pathMeta.crumbs} />
          </div>
        </div>

        {/* Right Side: Global Search & Quick Actions */}
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
