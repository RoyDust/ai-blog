"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { ChevronDown, LogOut, Settings, Sparkles, X } from "lucide-react";
import { MOBILE_MEDIA_QUERY, useAdminLayout } from "./AdminLayoutContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/admin/ui";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/shadcn/ui/sheet";
import { ADMIN_AI_GROUP_LABEL, type AdminNavItem, adminNavItems, isAdminNavItemActive } from "./config";
import { clearAllSessionData } from "@/lib/auth-client";

export { MOBILE_MEDIA_QUERY };

export interface AdminSiderProps {
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

async function signOutAdmin() {
  try {
    clearAllSessionData();
  } catch {
    // Disabled browser storage must never block signOut().
  }
  await signOut({ callbackUrl: "/" });
}

function UserAvatar({ image, userLabel }: { image?: string | null; userLabel: string }) {
  return (
    <span className="relative inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--admin-sidebar-active-bg)] text-xs font-semibold text-[var(--admin-sidebar-active)]">
      {image ? (
        <Image alt={`${userLabel} 头像`} className="h-full w-full object-cover" height={32} src={image} unoptimized width={32} />
      ) : (
        getInitials(userLabel)
      )}
    </span>
  );
}

function AdminSiderNavigation({
  aiGroupId,
  ariaLabel,
  collapsed,
  defaultAiOpen = false,
  onNavigate,
  pathname,
}: {
  aiGroupId: string;
  ariaLabel: string;
  collapsed: boolean;
  defaultAiOpen?: boolean;
  onNavigate?: () => void;
  pathname: string;
}) {
  const mainItems = adminNavItems.filter((item) => item.group === "主导航");
  const aiItems = adminNavItems.filter((item) => item.group === ADMIN_AI_GROUP_LABEL);
  const systemItems = adminNavItems.filter((item) => item.group === "系统");
  const isAiActive = aiItems.some((item) => isAdminNavItemActive(pathname, item.href));

  const renderNavItem = (item: AdminNavItem) => {
    const Icon = item.icon;
    const isActive = isAdminNavItemActive(pathname, item.href);
    const itemClassName = `flex items-center transition-colors duration-150 ${
      collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2"
    } rounded-[var(--radius-control)] text-[13px] ${
      isActive
        ? "bg-[var(--admin-sidebar-active-bg)] text-[var(--admin-sidebar-active)] font-semibold"
        : "font-medium text-[var(--admin-sidebar-text)] hover:bg-[var(--admin-sidebar-hover)] hover:text-[var(--admin-sidebar-fg)]"
    }`;

    if (item.disabled) {
      return (
        <button
          key={item.href}
          aria-label={`${item.label}稍后开放`}
          className={`flex w-full cursor-not-allowed items-center ${
            collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2"
          } rounded-[var(--radius-control)] text-[13px] font-medium text-[var(--admin-sidebar-muted)] opacity-60`}
          disabled
          type="button"
        >
          <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{item.label}</span>}
        </button>
      );
    }

    return (
      <Link
        key={item.href}
        aria-current={isActive ? "page" : undefined}
        aria-label={collapsed ? item.label : undefined}
        href={item.href}
        onClick={onNavigate}
        className={itemClassName}
        title={collapsed ? item.label : undefined}
      >
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
        {!collapsed && item.badge ? (
          <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-[var(--admin-sidebar-active-bg)] px-1.5 font-mono text-[11px] font-semibold tabular-nums text-[var(--admin-sidebar-active)]">
            {item.badge}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <nav aria-label={ariaLabel} className="reader-scrollbar-hidden flex-1 space-y-1 overflow-y-auto px-2.5 py-3.5">
      {!collapsed && (
        <p className="px-3 pb-1.5 text-[11px] font-semibold text-[var(--admin-sidebar-muted)]">博客后台</p>
      )}

      {mainItems.map(renderNavItem)}

      {collapsed ? (
        <Link
          aria-label={ADMIN_AI_GROUP_LABEL}
          href="/admin/ai-news"
          onClick={onNavigate}
          className="flex items-center justify-center rounded-[var(--radius-control)] py-2.5 text-[var(--admin-sidebar-text)] transition-colors hover:bg-[var(--admin-sidebar-hover)] hover:text-[var(--admin-sidebar-fg)]"
          title={ADMIN_AI_GROUP_LABEL}
        >
          <Sparkles aria-hidden="true" className="h-4 w-4 shrink-0" />
        </Link>
      ) : (
        <details className="group/ai" open={defaultAiOpen || isAiActive}>
          <summary
            className={`flex w-full cursor-pointer list-none items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-2 text-[13px] font-medium transition-colors [&::-webkit-details-marker]:hidden ${
              isAiActive
                ? "bg-[var(--admin-sidebar-hover)] font-semibold text-[var(--admin-sidebar-fg)]"
                : "text-[var(--admin-sidebar-text)] hover:bg-[var(--admin-sidebar-hover)] hover:text-[var(--admin-sidebar-fg)]"
            }`}
          >
            <Sparkles aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>{ADMIN_AI_GROUP_LABEL}</span>
            <ChevronDown
              aria-hidden="true"
              className="ml-auto h-3.5 w-3.5 -rotate-90 text-[var(--admin-sidebar-muted)] transition-transform group-open/ai:rotate-0"
            />
          </summary>
          <div id={aiGroupId} className="mt-1 space-y-0.5 pl-8 pr-1">
            {aiItems.map((item) => {
              const isActive = isAdminNavItemActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  aria-current={isActive ? "page" : undefined}
                  href={item.href}
                  onClick={onNavigate}
                  className={`block rounded-[var(--radius-control)] px-2.5 py-1.5 text-xs transition-colors ${
                    isActive
                      ? "bg-[var(--admin-sidebar-active-bg)] font-semibold text-[var(--admin-sidebar-active)]"
                      : "text-[var(--admin-sidebar-text)] opacity-85 hover:bg-[var(--admin-sidebar-hover)] hover:text-[var(--admin-sidebar-fg)] hover:opacity-100"
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
        <div className="mt-3 space-y-1 border-t border-[var(--admin-sidebar-border)] pt-3">
          {!collapsed && (
            <p className="px-3 pb-1.5 text-[11px] font-semibold text-[var(--admin-sidebar-muted)]">系统</p>
          )}
          {systemItems.map(renderNavItem)}
        </div>
      ) : null}
    </nav>
  );
}

export function AdminSider({ pathname, siteName, user }: AdminSiderProps) {
  const { isCollapsed } = useAdminLayout();
  const userLabel = user.label;
  const isSettingsActive = pathname === "/admin/settings";
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(isSettingsActive);
  const userMeta = user.email || (user.role === "ADMIN" ? "管理员" : user.role) || "管理员";

  return (
    <aside
      className={`sticky top-0 hidden h-screen overflow-hidden border-r border-[var(--admin-sidebar-border)] bg-[var(--admin-sidebar-bg)] transition-all duration-300 ease-in-out lg:flex lg:flex-col ${
        isCollapsed ? "w-[64px]" : "w-[224px]"
      }`}
      data-testid="admin-layout-sidebar"
    >
      <div className={`flex items-center justify-center border-b border-[var(--admin-sidebar-border)] transition-all duration-300 ${isCollapsed ? "px-2 py-3.5" : "px-4 py-3.5"}`}>
        <Link aria-label={`${siteName} 后台首页`} href="/admin" className={`flex w-full items-center ${isCollapsed ? "justify-center" : "gap-2.5"}`}>
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--admin-sidebar-active-bg)]">
            <Image alt="" aria-hidden="true" className="h-full w-full object-cover" height={32} priority src="/icons/icon-192.png" width={32} />
          </span>
          {!isCollapsed && (
            <span className="min-w-0 truncate font-display text-base font-bold tracking-tight text-[var(--admin-sidebar-fg)]">
              {siteName}
            </span>
          )}
        </Link>
      </div>

      <AdminSiderNavigation
        aiGroupId="admin-sider-ai-group"
        ariaLabel="Admin navigation"
        collapsed={isCollapsed}
        pathname={pathname}
      />

      <div className={`relative border-t border-[var(--admin-sidebar-border)] ${isCollapsed ? "px-2 py-3" : "px-3 py-3"} transition-all duration-300`}>
        <DropdownMenu modal={false} open={isAccountMenuOpen} onOpenChange={setIsAccountMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={`${userLabel} 账号菜单`}
              className={`flex w-full items-center ${isCollapsed ? "justify-center px-0 py-1" : "gap-2.5 px-2 py-1.5"} rounded-[var(--radius-control)] text-left transition-colors hover:bg-[var(--admin-sidebar-hover)]`}
              type="button"
            >
              <UserAvatar image={user.image} userLabel={userLabel} />
              {!isCollapsed && (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-[var(--admin-sidebar-fg)]">{userLabel}</p>
                    <p className="truncate text-[11px] text-[var(--admin-sidebar-muted)]">{userMeta}</p>
                  </div>
                  <ChevronDown className={`h-3.5 w-3.5 text-[var(--admin-sidebar-muted)] transition-transform ${isAccountMenuOpen ? "rotate-180" : ""}`} />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={isCollapsed ? "center" : "start"} className="w-48" side={isCollapsed ? "right" : "top"}>
            <DropdownMenuItem asChild className={isSettingsActive ? "bg-[color-mix(in_oklab,var(--brand)_10%,var(--surface))] text-[var(--brand)]" : undefined}>
              <Link aria-current={isSettingsActive ? "page" : undefined} href="/admin/settings">
                <Settings className="h-4 w-4" />
                设置
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-[var(--danger-foreground)] focus:bg-[var(--danger-surface)] focus:text-[var(--danger-foreground)]" onSelect={() => void signOutAdmin()}>
              <LogOut className="h-4 w-4" />
              退出账号
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}

export function AdminMobileDrawer({ pathname, siteName, user }: AdminSiderProps) {
  const { isMobileDrawerOpen, setMobileDrawerOpen, closeMobileDrawer } = useAdminLayout();
  const userLabel = user.label;
  const userMeta = user.email || (user.role === "ADMIN" ? "管理员" : user.role) || "管理员";
  const isSettingsActive = pathname === "/admin/settings";

  return (
    <Sheet open={isMobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
      <SheetContent
        className="admin-theme inset-y-0 left-0 flex h-dvh w-[264px] max-w-[85vw] flex-col gap-0 border-r border-[var(--admin-sidebar-border)] bg-[var(--admin-sidebar-bg)] p-0 text-[var(--admin-sidebar-fg)] shadow-xl sm:max-w-[264px]"
        data-testid="admin-mobile-drawer"
        id="admin-mobile-drawer"
        showCloseButton={false}
        side="left"
      >
        <SheetTitle className="sr-only">后台导航菜单</SheetTitle>
        <SheetDescription className="sr-only">切换管理后台页面、进入账号设置或退出登录。</SheetDescription>

        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-[var(--admin-sidebar-border)] px-4">
          <Link
            aria-label={`${siteName} 后台首页`}
            className="flex min-w-0 flex-1 items-center gap-2.5"
            href="/admin"
            onClick={closeMobileDrawer}
          >
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--admin-sidebar-active-bg)]">
              <Image alt="" aria-hidden="true" className="h-full w-full object-cover" height={32} src="/icons/icon-192.png" width={32} />
            </span>
            <span className="min-w-0 truncate font-display text-base font-bold text-[var(--admin-sidebar-fg)]">{siteName}</span>
          </Link>

          <SheetClose
            aria-label="关闭导航菜单"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-[var(--admin-sidebar-muted)] transition-colors hover:bg-[var(--admin-sidebar-hover)] hover:text-[var(--admin-sidebar-fg)]"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </SheetClose>
        </div>

        <AdminSiderNavigation
          aiGroupId="admin-mobile-sider-ai-group"
          ariaLabel="移动端后台导航"
          collapsed={false}
          defaultAiOpen
          onNavigate={closeMobileDrawer}
          pathname={pathname}
        />

        <div className="shrink-0 border-t border-[var(--admin-sidebar-border)] p-2.5">
          <div className="flex items-center gap-2.5 px-2.5 py-2">
            <UserAvatar image={user.image} userLabel={userLabel} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] font-semibold text-[var(--admin-sidebar-fg)]">{userLabel}</span>
              <span className="truncate text-xs text-[var(--admin-sidebar-muted)]">{userMeta}</span>
            </span>
          </div>

          <div className="mt-1 flex flex-col gap-0.5 border-t border-[var(--admin-sidebar-border)] pt-1.5">
            <Link
              aria-current={isSettingsActive ? "page" : undefined}
              className={`flex items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-2 text-[13px] transition-colors ${
                isSettingsActive
                  ? "bg-[var(--admin-sidebar-active-bg)] font-semibold text-[var(--admin-sidebar-active)]"
                  : "font-medium text-[var(--admin-sidebar-text)] hover:bg-[var(--admin-sidebar-hover)] hover:text-[var(--admin-sidebar-fg)]"
              }`}
              href="/admin/settings"
              onClick={closeMobileDrawer}
            >
              <Settings aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span className="truncate">设置</span>
            </Link>

            <button
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-2 text-left text-[13px] font-medium text-[var(--danger-foreground)] transition-colors hover:bg-[var(--danger-surface)]"
              onClick={() => {
                closeMobileDrawer();
                void signOutAdmin();
              }}
              type="button"
            >
              <LogOut aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span className="truncate">退出登录</span>
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
