"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X, ChevronDown, RotateCw } from "lucide-react";
import { useAdminLayout } from "./AdminLayoutContext";
import { ActiveUnderline } from "@/components/editorial";
import { adminIconButtonClassName } from "@/components/admin/primitives/admin-classes";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/admin/ui";
import { cn } from "@/lib/cn";

/**
 * 标签栏（方向 A）：44px，纯文字 tab，当前项 foreground + 2px sky 下划线（在 tab 之间平移），
 * 关闭用 12px ×，「首页」不可关闭；右侧刷新与下拉菜单是 32px 图标按钮。
 */
export function AdminTabsBar() {
  const pathname = usePathname();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { tabs, closeTab, closeOtherTabs, closeAllTabs } = useAdminLayout();

  const handleRefresh = () => {
    router.refresh();
  };

  return (
    <div className="flex h-11 shrink-0 items-stretch border-b border-[var(--reader-border)] bg-[var(--card-bg)] select-none">
      <div aria-label="已打开的页面" className="reader-scrollbar-hidden flex min-w-0 flex-1 items-stretch gap-0.5 overflow-x-auto px-3">
        <AnimatePresence initial={false}>
          {tabs.map((tab) => {
            const isActive = pathname === tab.href;
            const closable = tab.href !== "/admin";

            return (
              <motion.div
                key={tab.href}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  "group relative flex shrink-0 items-center gap-1 text-[0.8125rem] font-bold whitespace-nowrap",
                  closable ? "pr-1.5 pl-3" : "px-3",
                )}
                exit={reduceMotion ? undefined : { opacity: 0, x: -6, transition: { duration: 0.14 } }}
                initial={reduceMotion ? false : { opacity: 0, x: -6 }}
                layout={reduceMotion ? false : "position"}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex h-full items-center transition-colors duration-150",
                    isActive ? "text-[var(--foreground)]" : "text-[var(--text-muted)] hover:text-[var(--foreground)]",
                  )}
                  href={tab.href}
                >
                  {tab.label}
                </Link>

                {closable ? (
                  <button
                    aria-label={`关闭 ${tab.label} 标签`}
                    className="inline-flex size-[18px] items-center justify-center rounded-[2px] text-[var(--text-muted)] transition-colors duration-150 hover:bg-[color-mix(in_oklab,var(--foreground)_8%,transparent)] hover:text-[var(--foreground)]"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      closeTab(tab.href);
                    }}
                    type="button"
                  >
                    <X aria-hidden="true" className="size-3" />
                  </button>
                ) : null}

                {isActive ? <ActiveUnderline layoutId="admin-tabs-underline" /> : null}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 border-l border-[var(--reader-border)] px-2">
        <button aria-label="刷新页面" className={cn(adminIconButtonClassName, "size-8")} onClick={handleRefresh} title="刷新页面" type="button">
          <RotateCw aria-hidden="true" className="size-[15px]" />
        </button>

        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button aria-label="标签操作" className={cn(adminIconButtonClassName, "size-8")} type="button">
              <ChevronDown aria-hidden="true" className="size-[15px]" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={handleRefresh}>重新加载</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => closeOtherTabs(pathname)}>关闭其他标签</DropdownMenuItem>
            <DropdownMenuItem onClick={closeAllTabs}>关闭全部标签</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
