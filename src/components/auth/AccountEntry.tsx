"use client";

import { Bookmark, LayoutDashboard, LogOut, PenLine, UserRound } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";

import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "@/components/coss/ui/menu";
import { clearAllSessionData } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

const LazyLoginDialog = dynamic(
  () => import("@/components/auth/LoginDialog").then((mod) => mod.LoginDialog),
  { ssr: false },
);

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
        className="h-8 w-8 rounded-lg bg-cover bg-center ring-1 ring-[var(--reader-border)]"
        style={{ backgroundImage: `url(${image})` }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--btn-regular-bg)] text-xs font-bold text-[var(--btn-content)]"
    >
      {getInitial(label)}
    </span>
  );
}

const accountMenuItemClass =
  "flex cursor-default select-none items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-[var(--foreground)] outline-none transition-colors data-highlighted:bg-[var(--btn-regular-bg)] data-highlighted:text-[var(--btn-content)]";

export function AccountEntry() {
  const { data: session, status } = useSession();
  const [loginOpen, setLoginOpen] = useState(false);
  const [hasOpenedLogin, setHasOpenedLogin] = useState(false);
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
          className="reader-icon-btn text-current hover:text-[var(--accent-sky)]"
          onClick={() => {
            setHasOpenedLogin(true);
            setLoginOpen(true);
          }}
          title="登录账号"
          type="button"
        >
          <UserRound className="h-5 w-5" aria-hidden="true" />
        </button>
        {hasOpenedLogin ? <LazyLoginDialog open={loginOpen} onOpenChange={setLoginOpen} /> : null}
      </>
    );
  }

  return (
    <Menu>
      <MenuTrigger
        render={
          <button
            aria-label="账号菜单"
            className="reader-icon-btn overflow-hidden p-0 text-current hover:text-[var(--accent-sky)]"
            title={displayName}
            type="button"
          />
        }
      >
        <AccountAvatar image={user.image} label={displayName} />
      </MenuTrigger>
      <MenuPopup
        align="end"
        className="z-50 w-[min(92vw,17rem)] rounded-2xl border border-[var(--reader-border)] bg-[var(--reader-panel)] p-1 shadow-[var(--reader-shadow)] backdrop-blur-xl before:hidden"
        sideOffset={10}
      >
        <MenuGroup>
          <MenuGroupLabel className="px-3 py-2 font-normal">
            <span className="block truncate text-sm font-semibold text-[var(--foreground)]">{displayName}</span>
            {user.email ? <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">{user.email}</span> : null}
          </MenuGroupLabel>
        </MenuGroup>
        <MenuSeparator className="-mx-1 my-1 h-px bg-[var(--reader-border)]" />
        <MenuItem className={accountMenuItemClass} render={<Link href="/profile" />}>
          <UserRound className="h-4 w-4" aria-hidden="true" />
          个人资料
        </MenuItem>
        <MenuItem className={accountMenuItemClass} render={<Link href="/bookmarks" />}>
          <Bookmark className="h-4 w-4" aria-hidden="true" />
          我的收藏
        </MenuItem>
        {isAdmin ? (
          <>
            <MenuItem className={accountMenuItemClass} render={<Link href="/admin/posts/new" />}>
              <PenLine className="h-4 w-4" aria-hidden="true" />
              写文章
            </MenuItem>
            <MenuItem className={accountMenuItemClass} render={<Link href="/admin" />}>
              <LayoutDashboard className="h-4 w-4" aria-hidden="true" />
              控制台
            </MenuItem>
          </>
        ) : null}
        <MenuSeparator className="-mx-1 my-1 h-px bg-[var(--line-color)]" />
        <MenuItem
          className={cn(accountMenuItemClass, "text-[var(--danger-foreground)] data-highlighted:bg-[var(--danger-surface)] data-highlighted:text-[var(--danger-foreground)]")}
          onClick={() => void handleLogout()}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          退出登录
        </MenuItem>
      </MenuPopup>
    </Menu>
  );
}
