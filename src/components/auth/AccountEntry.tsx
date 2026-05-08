"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Bookmark, LayoutDashboard, LogOut, PenLine, UserRound } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

import { LoginDialog } from "@/components/auth/LoginDialog";
import { clearAllSessionData } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

function getInitial(value: string | null | undefined) {
  const firstCharacter = Array.from(value?.trim() || "")[0];
  return firstCharacter ? firstCharacter.toLocaleUpperCase("zh-CN") : "U";
}

type AccountAvatarProps = {
  image?: string | null;
  label: string;
};

function AccountAvatar({ image, label }: AccountAvatarProps) {
  if (image) {
    return (
      <span
        aria-hidden="true"
        className="h-8 w-8 rounded-full bg-cover bg-center ring-1 ring-[var(--reader-border)]"
        style={{ backgroundImage: `url(${image})` }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 items-center justify-center rounded-full border border-[color:color-mix(in_oklab,var(--accent-warm)_30%,var(--reader-border))] bg-[color:color-mix(in_oklab,var(--accent-warm)_14%,transparent)] text-xs font-bold text-[var(--accent-warm)]"
    >
      {getInitial(label)}
    </span>
  );
}

const accountMenuItemClass =
  "flex cursor-default select-none items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--foreground)] outline-none transition-colors focus:bg-[color:color-mix(in_oklab,var(--accent-sky)_12%,transparent)]";

export function AccountEntry() {
  const { data: session, status } = useSession();
  const [loginOpen, setLoginOpen] = useState(false);
  const user = session?.user;
  const displayName = user?.name || user?.email || "已登录账号";
  const isAdmin = user?.role === "ADMIN";

  const handleLogout = async () => {
    clearAllSessionData();

    await signOut({
      callbackUrl: "/",
      redirect: false,
    });

    window.location.href = "/";
  };

  if (status === "loading") {
    return (
      <span
        aria-label="正在加载账号"
        className="reader-icon-btn pointer-events-none animate-pulse text-[var(--muted)]"
        role="status"
      >
        <UserRound className="h-5 w-5" aria-hidden="true" />
      </span>
    );
  }

  if (!user) {
    return (
      <>
        <button
          aria-label="登录账号"
          className="reader-icon-btn text-current hover:text-[var(--accent-warm)]"
          onClick={() => setLoginOpen(true)}
          title="登录账号"
          type="button"
        >
          <UserRound className="h-5 w-5" aria-hidden="true" />
        </button>
        <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
      </>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          aria-label="账号菜单"
          className="reader-icon-btn overflow-hidden p-0 text-current hover:text-[var(--accent-warm)]"
          title={displayName}
          type="button"
        >
          <AccountAvatar image={user.image} label={displayName} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="z-50 w-[min(92vw,17rem)] rounded-2xl border border-[var(--reader-border)] bg-[var(--reader-panel)] p-2 shadow-[var(--reader-shadow)] backdrop-blur-xl"
          sideOffset={10}
        >
          <DropdownMenu.Label className="px-3 py-2">
            <span className="block truncate text-sm font-semibold text-[var(--foreground)]">{displayName}</span>
            {user.email ? <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">{user.email}</span> : null}
          </DropdownMenu.Label>
          <DropdownMenu.Separator className="-mx-2 my-1 h-px bg-[var(--reader-border)]" />
          <DropdownMenu.Item asChild className={accountMenuItemClass}>
            <Link href="/profile">
              <UserRound className="h-4 w-4" aria-hidden="true" />
              个人资料
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={accountMenuItemClass}>
            <Link href="/bookmarks">
              <Bookmark className="h-4 w-4" aria-hidden="true" />
              我的收藏
            </Link>
          </DropdownMenu.Item>
          {isAdmin ? (
            <>
              <DropdownMenu.Item asChild className={accountMenuItemClass}>
                <Link href="/admin/posts/new">
                  <PenLine className="h-4 w-4" aria-hidden="true" />
                  写文章
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild className={accountMenuItemClass}>
                <Link href="/admin">
                  <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
                  控制台
                </Link>
              </DropdownMenu.Item>
            </>
          ) : null}
          <DropdownMenu.Separator className="-mx-2 my-1 h-px bg-[var(--reader-border)]" />
          <DropdownMenu.Item
            className={cn(accountMenuItemClass, "text-rose-600 focus:bg-rose-50 focus:text-rose-700")}
            onSelect={(event) => {
              event.preventDefault();
              void handleLogout();
            }}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            退出登录
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
