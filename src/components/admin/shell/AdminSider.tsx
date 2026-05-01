"use client";

import Link from "next/link";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { ChevronDown, Leaf, LogOut, Settings, Sparkles } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/admin/ui";
import { type AdminNavItem, adminNavItems, isAdminNavItemActive } from "./config";

interface AdminSiderProps {
  pathname: string;
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

export function AdminSider({ pathname, user }: AdminSiderProps) {
  const userLabel = user.label;
  const mainItems = adminNavItems.filter((item) => item.group === "主导航");
  const aiItems = adminNavItems.filter((item) => item.group === "AI 辅助");
  const isAiActive = aiItems.some((item) => isAdminNavItemActive(pathname, item.href));
  const isSettingsActive = pathname === "/admin/settings";
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(isSettingsActive);
  const userMeta = user.email || (user.role === "ADMIN" ? "管理员" : user.role) || "管理员";

  const handleLogout = async () => {
    if (typeof window !== "undefined") {
      localStorage.clear();
    }

    await signOut({ callbackUrl: "/" });
  };

  const renderMainNavItem = (item: AdminNavItem) => {
    const Icon = item.icon;
    const isActive = isAdminNavItemActive(pathname, item.href);
    const itemClassName = `flex w-full items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition-colors ${
      isActive
        ? "bg-[color-mix(in_srgb,var(--brand)_10%,var(--surface-alt))] text-[var(--brand)]"
        : "text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
    }`;

    if (item.disabled) {
      return (
        <button
          key={item.href}
          aria-label={`${item.label}稍后开放`}
          className="flex w-full cursor-not-allowed items-center gap-3 rounded-lg px-3 py-3 text-base font-medium text-[var(--muted)] opacity-70"
          disabled
          type="button"
        >
          <Icon className="h-5 w-5" />
          <span>{item.label}</span>
        </button>
      );
    }

    return (
      <Link key={item.href} href={item.href} className={itemClassName}>
        <Icon className="h-5 w-5" />
        <span>{item.label}</span>
        {item.badge ? (
          <span className="ml-auto inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-amber-100 px-2 text-sm font-semibold text-amber-700">
            {item.badge}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <aside
      className="hidden sticky top-0 h-screen overflow-hidden border-r border-[var(--border)] bg-[var(--surface)] lg:flex lg:flex-col"
      data-testid="admin-layout-sidebar"
    >
      <div className="px-5 pb-7 pt-6">
        <Link href="/admin" className="flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-[var(--brand)]">
            <Leaf className="h-5 w-5" />
          </span>
          <span className="font-display text-2xl font-semibold tracking-tight text-[var(--foreground)]">roydust.top</span>
        </Link>
      </div>

      <nav aria-label="Admin navigation" className="flex-1 overflow-y-auto border-t border-[var(--border)] px-3 py-6">
        <p className="px-2 pb-4 font-display text-lg font-semibold text-[var(--foreground)]">博客后台</p>
        <div className="space-y-2">
          {mainItems.map(renderMainNavItem)}

          <details className="group/ai" open={isAiActive}>
            <summary
              className={`flex w-full cursor-pointer list-none items-center gap-3 rounded-lg px-3 py-3 text-base font-medium transition-colors [&::-webkit-details-marker]:hidden ${
                isAiActive
                  ? "bg-[color-mix(in_srgb,var(--brand)_10%,var(--surface-alt))] text-[var(--brand)]"
                  : "text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
              }`}
            >
              <Sparkles className="h-5 w-5" />
              <span>AI 助手</span>
              <ChevronDown className="ml-auto h-4 w-4 -rotate-90 transition-transform group-open/ai:rotate-0" />
            </summary>
            <div className="mt-1 space-y-1 border-l border-[var(--border)] pl-5 ml-5">
              {aiItems.map((item) => {
                const isActive = isAdminNavItemActive(pathname, item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                      isActive ? "bg-emerald-50 font-medium text-[var(--brand)]" : "text-[var(--muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </details>
        </div>
      </nav>

      <div className="relative border-t border-[var(--border)] px-5 py-5">
        <DropdownMenu modal={false} open={isAccountMenuOpen} onOpenChange={setIsAccountMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              aria-label={`${userLabel} 账号菜单`}
              className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors ${
                isSettingsActive ? "bg-[color-mix(in_srgb,var(--brand)_10%,var(--surface-alt))]" : "hover:bg-[var(--surface-alt)]"
              }`}
              type="button"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-[var(--surface-alt)] text-base font-semibold text-[var(--foreground)]">
                {user.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={`${userLabel} 头像`} className="h-full w-full object-cover" src={user.image} />
                ) : (
                  getInitials(userLabel)
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-medium text-[var(--foreground)]">{userLabel}</p>
                <p className="truncate text-sm text-[var(--muted)]">{userMeta}</p>
              </div>
              <ChevronDown className={`h-4 w-4 text-[var(--muted)] transition-transform ${isAccountMenuOpen ? "rotate-180" : ""}`} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48" side="top">
            <DropdownMenuItem asChild className={isSettingsActive ? "bg-emerald-50 text-[var(--brand)]" : undefined}>
              <Link href="/admin/settings">
                <Settings className="h-4 w-4" />
                设置
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="text-rose-600 focus:bg-rose-50 focus:text-rose-600" onSelect={() => void handleLogout()}>
              <LogOut className="h-4 w-4" />
              退出账号
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
