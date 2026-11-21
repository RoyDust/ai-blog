"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { X, ChevronDown, RotateCw, ShieldClose, RefreshCw } from "lucide-react";
import { useAdminLayout } from "./AdminLayoutContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/admin/ui";

export function AdminTabsBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { tabs, closeTab, closeOtherTabs, closeAllTabs } = useAdminLayout();

  const handleRefresh = () => {
    router.refresh();
  };

  return (
    <div className="flex h-9 items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 select-none transition-colors duration-200">
      {/* Scrollable Tabs Wrapper */}
      <div className="flex flex-1 items-center gap-1 overflow-x-auto reader-scrollbar-hidden py-1">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <div
              key={tab.href}
              className={`group relative flex h-6.5 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors duration-150 cursor-pointer ${
                isActive
                  ? "bg-[var(--btn-regular-bg)] font-semibold text-[var(--btn-content)]"
                  : "text-[var(--muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
              }`}
            >
              {/* Vben signature dot for active tab */}
              {isActive && (
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand)]" />
              )}

              <Link href={tab.href} className="whitespace-nowrap">
                {tab.label}
              </Link>

              {/* Close Button */}
              {tab.href !== "/admin" && (
                <button
                  aria-label={`关闭 ${tab.label} 标签`}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    closeTab(tab.href);
                  }}
                  className="rounded-full p-0.5 text-[var(--muted)] transition-colors hover:bg-[var(--surface-contrast)] hover:text-[var(--foreground)]"
                  type="button"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Tabs Actions Dropdown */}
      <div className="flex items-center pl-2 border-l border-[var(--border)] gap-1 shrink-0">
        <button
          aria-label="刷新页面"
          onClick={handleRefresh}
          className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)] transition-colors"
          title="刷新页面"
          type="button"
        >
          <RotateCw className="h-3.5 w-3.5" />
        </button>

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="标签操作"
              className="flex items-center justify-center rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)] transition-colors"
              type="button"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={handleRefresh}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              重新加载
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => closeOtherTabs(pathname)}>
              <ShieldClose className="mr-2 h-3.5 w-3.5" />
              关闭其他标签
            </DropdownMenuItem>
            <DropdownMenuItem onClick={closeAllTabs}>
              <X className="mr-2 h-3.5 w-3.5" />
              关闭全部标签
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
