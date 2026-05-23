"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { ChevronDown, LogOut, Settings, Sparkles } from "lucide-react";
import { useAdminLayout } from "./AdminLayoutContext";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/admin/ui";
import { ADMIN_AI_GROUP_LABEL, type AdminNavItem, adminNavItems, isAdminNavItemActive } from "./config";
import { clearAllSessionData } from "@/lib/auth-client";

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

export function AdminSider({ pathname, siteName, user }: AdminSiderProps) {
  const { isCollapsed } = useAdminLayout();
  const userLabel = user.label;
  const mainItems = adminNavItems.filter((item) => item.group === "主导航");
  const aiItems = adminNavItems.filter((item) => item.group === ADMIN_AI_GROUP_LABEL);
  const systemItems = adminNavItems.filter((item) => item.group === "系统");
  const isAiActive = aiItems.some((item) => isAdminNavItemActive(pathname, item.href));
  const isSettingsActive = pathname === "/admin/settings";
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(isSettingsActive);
  const userMeta = user.email || (user.role === "ADMIN" ? "管理员" : user.role) || "管理员";

  const handleLogout = async () => {
    clearAllSessionData();
    await signOut({ callbackUrl: "/" });
  };

  const renderNavItem = (item: AdminNavItem) => {
    const Icon = item.icon;
    const isActive = isAdminNavItemActive(pathname, item.href);
    const itemClassName = `flex items-center transition-all duration-200 ${
      isCollapsed ? "justify-center px-0 py-3" : "gap-3 px-3.5 py-2.5"
    } rounded-lg text-sm font-medium ${
      isActive
        ? "bg-[var(--vben-primary)] text-white font-semibold shadow-md shadow-blue-500/20"
        : "text-[var(--vben-sidebar-text)] hover:bg-[var(--vben-sidebar-hover)] hover:text-white"
    }`;

    if (item.disabled) {
      return (
        <button
          key={item.href}
          aria-label={`${item.label}稍后开放`}
          className={`flex w-full cursor-not-allowed items-center ${
            isCollapsed ? "justify-center px-0 py-3" : "gap-3 px-3.5 py-2.5"
          } rounded-lg text-sm font-medium text-[var(--vben-sidebar-muted)] opacity-60`}
          disabled
          type="button"
        >
          <Icon className="h-5 w-5 shrink-0" />
          {!isCollapsed && <span>{item.label}</span>}
        </button>
      );
    }

    return (
      <Link key={item.href} href={item.href} className={itemClassName} title={isCollapsed ? item.label : undefined}>
        <Icon className="h-5 w-5 shrink-0" />
        {!isCollapsed && <span className="truncate">{item.label}</span>}
        {!isCollapsed && item.badge ? (
          <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 dark:bg-blue-600 px-1.5 text-[0.65rem] font-bold text-white">
            {item.badge}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <aside
      className={`hidden sticky top-0 h-screen overflow-hidden border-r border-[var(--vben-sidebar-border)] bg-[var(--vben-sidebar-bg)] lg:flex lg:flex-col transition-all duration-300 ease-in-out ${
        isCollapsed ? "w-[64px]" : "w-[224px]"
      }`}
      data-testid="admin-layout-sidebar"
    >
      {/* Brand logo section */}
      <div className={`transition-all duration-300 ${isCollapsed ? "px-2 py-4" : "px-5 py-5"} flex items-center justify-center border-b border-[var(--vben-sidebar-border)]`}>
        <Link aria-label={`${siteName} 后台首页`} href="/admin" className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"} w-full`}>
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--vben-primary)] shadow-md shadow-blue-500/20">
            <Image alt="" aria-hidden="true" className="h-full w-full object-cover" height={36} priority src="/icons/icon-192.png" width={36} />
          </span>
          {!isCollapsed && (
            <span className="min-w-0 truncate font-display text-xl font-bold tracking-tight text-white transition-all duration-300">
              {siteName}
            </span>
          )}
        </Link>
      </div>

      {/* Navigation menu */}
      <nav aria-label="Admin navigation" className="flex-1 overflow-y-auto reader-scrollbar-hidden px-2.5 py-4 space-y-1.5">
        {!isCollapsed && (
          <p className="px-3 pb-2 text-xs font-semibold text-[var(--vben-sidebar-muted)] uppercase tracking-wider">博客后台</p>
        )}

        {mainItems.map(renderNavItem)}

        {/* AI group menu */}
        {isCollapsed ? (
          // If collapsed, just render direct shortcut link
          <Link
            href="/admin/ai-news"
            className={`flex items-center justify-center py-3 rounded-lg text-[var(--vben-sidebar-text)] hover:bg-[var(--vben-sidebar-hover)] hover:text-white transition-all`}
            title="AI 助手"
          >
            <Sparkles className="h-5 w-5 shrink-0" />
          </Link>
        ) : (
          <details className="group/ai" open={isAiActive}>
            <summary
              className={`flex w-full cursor-pointer list-none items-center gap-3 px-3.5 py-2.5 text-sm font-medium rounded-lg transition-all [&::-webkit-details-marker]:hidden ${
                isAiActive
                  ? "text-white bg-[var(--vben-sidebar-hover)]"
                  : "text-[var(--vben-sidebar-text)] hover:bg-[var(--vben-sidebar-hover)] hover:text-white"
              }`}
            >
              <Sparkles className="h-5 w-5 shrink-0" />
              <span>AI 助手</span>
              <ChevronDown className="ml-auto h-4 w-4 -rotate-90 transition-transform group-open/ai:rotate-0" />
            </summary>
            <div className="mt-1.5 space-y-1 pl-9 pr-1">
              {aiItems.map((item) => {
                const isActive = isAdminNavItemActive(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block rounded-md px-3 py-2 text-xs transition-colors ${
                      isActive
                        ? "bg-[var(--vben-primary)] text-white font-medium shadow-sm shadow-blue-500/10"
                        : "text-[var(--vben-sidebar-text)] opacity-75 hover:opacity-100 hover:bg-[var(--vben-sidebar-hover)] hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </details>
        )}

        {systemItems.length ? (
          <div className="space-y-1.5 border-t border-[var(--vben-sidebar-border)] pt-3.5 mt-3.5">
            {!isCollapsed && (
              <p className="px-3 pb-2 text-xs font-semibold text-[var(--vben-sidebar-muted)] uppercase tracking-wider">系统</p>
            )}
            {systemItems.map(renderNavItem)}
          </div>
        ) : null}
      </nav>

      {/* User profile dropdown at the bottom */}
      <div className={`relative border-t border-[var(--vben-sidebar-border)] ${isCollapsed ? "px-2 py-4" : "px-3 py-4"} transition-all duration-300`}>
        <DropdownMenu modal={false} open={isAccountMenuOpen} onOpenChange={setIsAccountMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={`${userLabel} 账号菜单`}
              className={`flex w-full items-center ${isCollapsed ? "justify-center px-0 py-1" : "gap-3 px-2 py-2"} rounded-lg text-left transition-all hover:bg-[var(--vben-sidebar-hover)]`}
              type="button"
            >
              <span className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-700 text-sm font-semibold text-white shadow-sm">
                {user.image ? (
                  <Image alt={`${userLabel} 头像`} className="h-full w-full object-cover" height={36} src={user.image} unoptimized width={36} />
                ) : (
                  getInitials(userLabel)
                )}
              </span>
              {!isCollapsed && (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white">{userLabel}</p>
                    <p className="truncate text-xs text-[var(--vben-sidebar-muted)]">{userMeta}</p>
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 text-[var(--vben-sidebar-muted)] transition-transform ${isAccountMenuOpen ? "rotate-180" : ""}`} />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isCollapsed ? "center" : "start"} className="w-48" side={isCollapsed ? "right" : "top"}>
            <DropdownMenuItem asChild className={isSettingsActive ? "bg-blue-50/60 dark:bg-blue-950/30 text-[var(--brand)]" : undefined}>
              <Link href="/admin/settings">
                <Settings className="h-4 w-4" />
                设置
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="text-rose-600 focus:bg-rose-50 dark:focus:bg-rose-950/30 focus:text-rose-600" onSelect={() => void handleLogout()}>
              <LogOut className="h-4 w-4" />
              退出账号
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
