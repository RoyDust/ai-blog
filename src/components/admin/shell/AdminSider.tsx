"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, type ReactNode } from "react";
import { signOut } from "next-auth/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { ChevronDown, ChevronsUpDown, Sparkles } from "lucide-react";
import { useAdminLayout } from "./AdminLayoutContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/admin/ui";
import { collapseMotion } from "@/components/editorial";
import { BrandMark } from "@/components/layout/BrandMark";
import { ADMIN_AI_GROUP_LABEL, type AdminNavItem, adminNavItems, isAdminNavItemActive } from "./config";
import { clearAllSessionData } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

interface AdminSiderProps {
  pathname: string;
  siteName: string;
  user: {
    email?: string | null;
    image?: string | null;
    label: string;
    role?: string | null;
  };
}

function getInitials(value: string) {
  const words = value.trim().match(/[A-Z]?[a-z0-9]+|[A-Z]+(?![a-z])/g);
  if (words?.length) {
    return words
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join("");
  }

  return [...value.trim()].slice(0, 2).join("").toUpperCase() || "A";
}

const INDICATOR_LAYOUT_ID = "admin-sider-active";

/**
 * 当前项指示：白 8% 底 + 左侧 2px sky 竖线（侧栏上用亮一档的 --sider-accent）。
 * 同一 layoutId 在条目之间平移；减少动态效果时直接切换。
 */
function ActiveIndicator() {
  const reduceMotion = useReducedMotion();
  return (
    <motion.span
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 rounded-[var(--radius-ctl)] bg-[var(--sider-active-bg)] shadow-[inset_2px_0_0_var(--sider-accent)]"
      layoutId={reduceMotion ? undefined : INDICATOR_LAYOUT_ID}
      transition={{ type: "spring", stiffness: 520, damping: 44, mass: 0.7 }}
    />
  );
}

/** 收起到 64px 时的悬停提示：foreground 底、4px 圆角的小标签 */
function CollapsedTip({ label, enabled, children }: { label: string; enabled: boolean; children: ReactNode }) {
  if (!enabled) return <>{children}</>;

  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          className="z-50 rounded-[var(--radius-ctl)] bg-[var(--foreground)] px-2 py-1 text-xs font-bold text-[var(--card-bg)] transition-[opacity,translate] duration-150 ease-out starting:-translate-x-1 starting:opacity-0 motion-reduce:transition-none"
          side="right"
          sideOffset={8}
        >
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

const navItemBaseClassName =
  "relative flex h-10 items-center rounded-[var(--radius-ctl)] text-[0.875rem] whitespace-nowrap transition-colors duration-150";

/** 组标题：.75rem 700 字距 .08em；收起时换成 1px 细线 */
function GroupTitle({ children, collapsed }: { children: ReactNode; collapsed: boolean }) {
  if (collapsed) {
    return <span aria-hidden="true" className="mx-2 my-2 block h-px bg-[var(--sider-line)]" />;
  }

  return <p className="px-3 pb-1.5 text-xs font-bold tracking-[0.08em] text-[var(--sider-muted)]">{children}</p>;
}

export function AdminSider({ pathname, siteName, user }: AdminSiderProps) {
  const { isCollapsed } = useAdminLayout();
  const reduceMotion = useReducedMotion();
  const userLabel = user.label;
  const mainItems = adminNavItems.filter((item) => item.group === "主导航");
  const aiItems = adminNavItems.filter((item) => item.group === ADMIN_AI_GROUP_LABEL);
  const systemItems = adminNavItems.filter((item) => item.group === "系统");
  const isAiActive = aiItems.some((item) => isAdminNavItemActive(pathname, item.href));
  const isSettingsActive = pathname === "/admin/settings";
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(isSettingsActive);
  const [isAiOpen, setIsAiOpen] = useState(isAiActive);
  // 渲染期调整：路由进入 AI 助手组时自动展开该组（不在 effect 里 setState）
  const [lastPathname, setLastPathname] = useState(pathname);
  if (lastPathname !== pathname) {
    setLastPathname(pathname);
    if (isAiActive && !isAiOpen) {
      setIsAiOpen(true);
    }
  }
  const userMeta = user.email || (user.role === "ADMIN" ? "管理员" : user.role) || "管理员";

  const handleLogout = async () => {
    clearAllSessionData();
    await signOut({ callbackUrl: "/" });
  };

  const renderNavItem = (item: AdminNavItem) => {
    const Icon = item.icon;
    const isActive = isAdminNavItemActive(pathname, item.href);
    const layoutClassName = isCollapsed ? "justify-center px-0" : "gap-2.5 px-3";

    if (item.disabled) {
      return (
        <button
          key={item.href}
          aria-label={`${item.label}稍后开放`}
          className={cn(navItemBaseClassName, layoutClassName, "w-full cursor-not-allowed text-[var(--sider-muted)] opacity-60")}
          disabled
          type="button"
        >
          <Icon aria-hidden="true" className="size-4 shrink-0" />
          {!isCollapsed && <span>{item.label}</span>}
        </button>
      );
    }

    return (
      <CollapsedTip enabled={isCollapsed} key={item.href} label={item.label}>
        <Link
          aria-current={isActive ? "page" : undefined}
          aria-label={isCollapsed ? item.label : undefined}
          className={cn(
            navItemBaseClassName,
            layoutClassName,
            "group/nav",
            isActive ? "font-bold text-white" : "text-[var(--sider-fg)] hover:bg-[var(--sider-hover)] hover:text-white",
          )}
          href={item.href}
        >
          {isActive ? <ActiveIndicator /> : null}
          <Icon
            aria-hidden="true"
            className={cn(
              "relative size-4 shrink-0 transition-colors",
              isActive ? "text-white" : "text-[var(--sider-muted)] group-hover/nav:text-white",
            )}
            strokeWidth={1.75}
          />
          {!isCollapsed && <span className="relative truncate">{item.label}</span>}
          {!isCollapsed && item.badge ? (
            <span className="ed-mono relative ml-auto text-xs font-bold text-[var(--sider-accent)]">{item.badge}</span>
          ) : null}
        </Link>
      </CollapsedTip>
    );
  };

  return (
    <TooltipPrimitive.Provider delayDuration={120}>
      <aside
        className={cn(
          "sticky top-0 hidden h-screen overflow-hidden border-r border-[var(--sider-line)] bg-[var(--sider-bg)] text-[var(--sider-fg)] lg:flex lg:flex-col",
          "transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none",
          isCollapsed ? "w-[64px]" : "w-[224px]",
        )}
        data-testid="admin-layout-sidebar"
      >
        {/* 品牌区：白底衬线字标方块 + 衬线站名，高度与顶栏一致 68px */}
        <div className={cn("flex h-[68px] shrink-0 items-center border-b border-[var(--sider-line)]", isCollapsed ? "justify-center px-2" : "px-5")}>
          <Link aria-label={`${siteName} 后台首页`} className={cn("flex min-w-0 items-center", isCollapsed ? "justify-center" : "gap-2.5")} href="/admin">
            <BrandMark className="bg-[rgb(255_255_255/0.92)] text-[var(--sider-bg)]" siteName={siteName} size={32} />
            {!isCollapsed && (
              <span className="min-w-0 truncate font-serif text-[1.0625rem] font-bold text-white">{siteName}</span>
            )}
          </Link>
        </div>

        {/* 导航：16px 线性图标保留（收起时只能靠图标识别） */}
        <nav aria-label="Admin navigation" className="reader-scrollbar-hidden flex flex-1 flex-col gap-0.5 overflow-y-auto px-2.5 pt-4 pb-2">
          <GroupTitle collapsed={isCollapsed}>博客后台</GroupTitle>

          {mainItems.map(renderNavItem)}

          {/* AI 助手折叠组 */}
          {isCollapsed ? (
            <CollapsedTip enabled label={ADMIN_AI_GROUP_LABEL}>
              <Link
                aria-label={ADMIN_AI_GROUP_LABEL}
                className={cn(
                  navItemBaseClassName,
                  "group/nav justify-center px-0",
                  isAiActive ? "text-white" : "text-[var(--sider-fg)] hover:bg-[var(--sider-hover)] hover:text-white",
                )}
                href="/admin/ai-news"
              >
                {isAiActive ? <ActiveIndicator /> : null}
                <Sparkles
                  aria-hidden="true"
                  className={cn("relative size-4 shrink-0", isAiActive ? "text-white" : "text-[var(--sider-muted)] group-hover/nav:text-white")}
                  strokeWidth={1.75}
                />
              </Link>
            </CollapsedTip>
          ) : (
            <div>
              <button
                aria-controls="admin-sider-ai-group"
                aria-expanded={isAiOpen}
                className={cn(
                  navItemBaseClassName,
                  "group/nav w-full cursor-pointer gap-2.5 px-3 text-left",
                  isAiActive ? "font-bold text-white" : "text-[var(--sider-fg)]",
                  "hover:bg-[var(--sider-hover)] hover:text-white",
                )}
                onClick={() => setIsAiOpen((current) => !current)}
                type="button"
              >
                <Sparkles
                  aria-hidden="true"
                  className={cn("size-4 shrink-0", isAiActive ? "text-white" : "text-[var(--sider-muted)] group-hover/nav:text-white")}
                  strokeWidth={1.75}
                />
                <span className="flex-1">{ADMIN_AI_GROUP_LABEL}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "size-3.5 text-[var(--sider-muted)] transition-transform duration-200 motion-reduce:transition-none",
                    isAiOpen && "rotate-180",
                  )}
                />
              </button>
              <AnimatePresence initial={false}>
                {isAiOpen ? (
                  <motion.div
                    key="ai-group"
                    className="overflow-hidden"
                    id="admin-sider-ai-group"
                    {...(reduceMotion ? {} : collapseMotion)}
                  >
                    <div className="flex flex-col gap-0.5 pt-0.5">
                      {aiItems.map((item) => {
                        const isActive = isAdminNavItemActive(pathname, item.href);

                        return (
                          <Link
                            key={item.href}
                            aria-current={isActive ? "page" : undefined}
                            className={cn(
                              "relative flex h-[34px] items-center rounded-[var(--radius-ctl)] pr-3 pl-[38px] text-[0.8125rem] whitespace-nowrap transition-colors duration-150",
                              isActive ? "font-bold text-white" : "text-[var(--sider-fg)] hover:bg-[var(--sider-hover)] hover:text-white",
                            )}
                            href={item.href}
                          >
                            {isActive ? <ActiveIndicator /> : null}
                            <span className="relative truncate">{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          )}

          {systemItems.length ? (
            <div className="mt-1 flex flex-col gap-0.5 border-t border-[var(--sider-line)] pt-3">
              <GroupTitle collapsed={isCollapsed}>系统</GroupTitle>
              {systemItems.map(renderNavItem)}
            </div>
          ) : null}
        </nav>

        {/* 账号区 */}
        <div className={cn("relative shrink-0 border-t border-[var(--sider-line)]", isCollapsed ? "px-2 py-2.5" : "p-2.5")}>
          <DropdownMenu modal={false} open={isAccountMenuOpen} onOpenChange={setIsAccountMenuOpen}>
            <DropdownMenuTrigger asChild>
              <button
                aria-label={`${userLabel} 账号菜单`}
                className={cn(
                  "flex w-full items-center rounded-[var(--radius-ctl)] text-left transition-colors duration-150 hover:bg-[var(--sider-hover)] aria-expanded:bg-[var(--sider-hover)]",
                  isCollapsed ? "justify-center px-0 py-1.5" : "gap-2.5 px-2.5 py-2",
                )}
                type="button"
              >
                <span className="relative inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[rgb(255_255_255/0.12)] text-[0.8125rem] font-bold text-white">
                  {user.image ? (
                    <Image alt={`${userLabel} 头像`} className="h-full w-full object-cover" height={32} src={user.image} unoptimized width={32} />
                  ) : (
                    getInitials(userLabel)
                  )}
                </span>
                {!isCollapsed && (
                  <>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[0.875rem] font-bold text-white">{userLabel}</span>
                      <span className="truncate text-xs text-[var(--sider-muted)]">{userMeta}</span>
                    </span>
                    <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-[var(--sider-muted)]" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isCollapsed ? "center" : "start"} className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-48" side={isCollapsed ? "right" : "top"}>
              <DropdownMenuItem asChild className={isSettingsActive ? "font-bold" : undefined}>
                <Link aria-current={isSettingsActive ? "page" : undefined} href="/admin/settings">
                  设置
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void handleLogout()} variant="destructive">
                退出账号
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </TooltipPrimitive.Provider>
  );
}
