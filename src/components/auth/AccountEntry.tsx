"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { UserRound } from "lucide-react";
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
      className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--reader-border-strong)] bg-[var(--surface-alt)] text-xs font-bold text-[var(--foreground)]"
    >
      {getInitial(label)}
    </span>
  );
}

const accountMenuItemClass =
  "flex min-h-11 cursor-default select-none items-center rounded-[var(--radius-ctl)] px-3 text-sm font-bold text-[var(--text-body)] outline-none transition-colors focus:bg-[var(--ed-press-bg)] focus:text-[var(--foreground)]";

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
        className="ed-icon-btn pointer-events-none animate-pulse text-[var(--text-muted)]"
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
          className="ed-icon-btn"
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
          className="ed-icon-btn p-0"
          title={displayName}
          type="button"
        >
          <AccountAvatar image={user.image} label={displayName} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="ed-popover account-menu-content z-50 w-[min(92vw,16rem)] p-1.5"
          sideOffset={10}
        >
          <DropdownMenu.Label className="px-3 py-2">
            <span className="block truncate text-sm font-bold text-[var(--foreground)]">{displayName}</span>
            {user.email ? <span className="ed-mono mt-0.5 block truncate text-xs text-[var(--text-muted)]">{user.email}</span> : null}
          </DropdownMenu.Label>
          <DropdownMenu.Separator className="-mx-1.5 my-1 h-px bg-[var(--border)]" />
          <DropdownMenu.Item asChild className={accountMenuItemClass}>
            <Link href="/profile">
              个人资料
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild className={accountMenuItemClass}>
            <Link href="/bookmarks">
              我的收藏
            </Link>
          </DropdownMenu.Item>
          {isAdmin ? (
            <>
              <DropdownMenu.Item asChild className={accountMenuItemClass}>
                <Link href="/admin/posts/new">
                  写文章
                </Link>
              </DropdownMenu.Item>
              <DropdownMenu.Item asChild className={accountMenuItemClass}>
                <Link href="/admin">
                  控制台
                </Link>
              </DropdownMenu.Item>
            </>
          ) : null}
          <DropdownMenu.Separator className="-mx-1.5 my-1 h-px bg-[var(--border)]" />
          <DropdownMenu.Item
            className={cn(accountMenuItemClass, "text-[var(--danger-foreground)] focus:text-[var(--danger-foreground)]")}
            onSelect={(event) => {
              event.preventDefault();
              void handleLogout();
            }}
          >
            退出登录
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
