"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Bell, CheckCheck, CircleCheck, Info, Inbox, XCircle } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/admin/ui";
import { apiFetcher, apiMutate, handleGlobalSwrError, toErrorMessage } from "@/lib/client-api";

type NotificationItem = {
  id: string;
  receiptId: string;
  type: string;
  severity: string;
  title: string;
  body: string | null;
  actionUrl: string | null;
  createdAt: string;
  readAt: string | null;
};

type NotificationPayload = {
  items: NotificationItem[];
  unreadCount: number;
  nextCursor: string | null;
};

const severityMeta = {
  SUCCESS: { icon: CircleCheck, className: "bg-[var(--success-surface)] text-[var(--success-foreground)]" },
  WARNING: { icon: AlertCircle, className: "bg-[var(--warning-surface)] text-[var(--warning-foreground)]" },
  ERROR: { icon: XCircle, className: "bg-[var(--danger-surface)] text-[var(--danger-foreground)]" },
  INFO: { icon: Info, className: "bg-[color-mix(in_oklab,var(--brand)_10%,var(--surface))] text-[var(--brand)]" },
} as const;

function formatUnreadCount(count: number) {
  return count > 99 ? "99+" : String(count);
}

function formatRelativeTime(value: string) {
  const date = new Date(value);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.round(diffMs / 60_000));

  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;

  const days = Math.round(hours / 24);
  if (days < 7) return `${days} 天前`;

  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

/**
 * 后台顶部栏通知入口。
 *
 * 负责轮询最近通知、展示未读数、标记已读，以及按通知 actionUrl 跳转。
 */
export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const label = useMemo(() => (unreadCount > 0 ? `通知，${unreadCount} 条未读` : "通知"), [unreadCount]);

  /**
   * 铃铛数据的请求与轮询交给 SWR（30s refreshInterval + 焦点重验证），
   * onSuccess 把数据同步进本地状态：已读操作需要本地乐观更新（接口的 GET
   * 响应可能滞后于 PATCH 结果），沿用原有的"PATCH 返回校准 + 本地翻转"语义。
   */
  const { isLoading, mutate } = useSWR<{ success?: boolean; data?: NotificationPayload }>(
    "/api/admin/notifications?limit=8",
    apiFetcher,
    {
      refreshInterval: 30_000,
      revalidateOnFocus: true,
      onSuccess: (data) => {
        setItems(data?.data?.items ?? []);
        setUnreadCount(data?.data?.unreadCount ?? 0);
      },
      onError: (loadError, key) => {
        handleGlobalSwrError(loadError, key);
        setError(toErrorMessage(loadError, "通知加载失败"));
      },
    },
  );
  const loading = isLoading;

  /**
   * 标记指定通知为已读，并用接口返回的 unreadCount 校准本地角标。
   */
  const markRead = useCallback(async (ids: string[]) => {
    if (ids.length === 0) {
      return;
    }

    const payload = await apiMutate<{ success?: boolean; data?: { unreadCount: number } }>("/api/admin/notifications", {
      method: "PATCH",
      body: JSON.stringify({ action: "read", ids }),
    });

    setUnreadCount(payload.data?.unreadCount ?? unreadCount);
    setItems((current) => current.map((item) => (ids.includes(item.id) ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item)));
    void mutate();
  }, [mutate, unreadCount]);

  /**
   * 批量标记所有通知已读。
   *
   * 失败时保留当前列表状态并显示错误，避免误导用户以为远端状态已更新。
   */
  const markAllRead = useCallback(async () => {
    try {
      const payload = await apiMutate<{ success?: boolean; data?: { unreadCount: number } }>("/api/admin/notifications/read-all", { method: "POST" });
      if (!payload.data) {
        setError("通知状态更新失败");
        toast.error("通知状态更新失败");
        return;
      }

      setUnreadCount(payload.data.unreadCount);
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
      void mutate();
    } catch (error) {
      setError("通知状态更新失败");
      toast.error(toErrorMessage(error, "通知状态更新失败"));
    }
  }, [mutate]);

  /**
   * 打开单条通知。
   *
   * 未读通知会先提交已读状态，再按 actionUrl 进入对应管理页面。
   */
  const openNotification = useCallback(
    async (item: NotificationItem) => {
      try {
        if (!item.readAt) {
          await markRead([item.id]);
        }

        if (item.actionUrl) {
          router.push(item.actionUrl);
        }
      } catch (openError) {
        setError(toErrorMessage(openError, "通知状态更新失败"));
        toast.error(toErrorMessage(openError, "通知状态更新失败"));
      }
    },
    [markRead, router],
  );

  return (
    <DropdownMenu onOpenChange={(open) => open && void mutate()}>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={label}
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-lg text-[var(--foreground)] transition-colors hover:bg-[var(--surface-alt)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          type="button"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 ? (
            <span aria-hidden="true" className="absolute -right-1 -top-1 inline-flex min-w-6 items-center justify-center rounded-full bg-[var(--danger-foreground)] px-1.5 py-0.5 text-xs font-bold leading-none text-[var(--surface)] ring-2 ring-[var(--surface)]">
              {formatUnreadCount(unreadCount)}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(92vw,390px)] p-0">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-[var(--foreground)]">通知</p>
            <p className="mt-0.5 text-xs text-[var(--muted)]">{unreadCount > 0 ? `${unreadCount} 条未读` : "全部已读"}</p>
          </div>
          <button
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--brand)] transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={unreadCount === 0}
            onClick={() => void markAllRead()}
            type="button"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            全部已读
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto p-2">
          {loading ? <p className="px-3 py-8 text-center text-sm text-[var(--muted)]">正在加载通知...</p> : null}
          {!loading && error ? <p className="px-3 py-8 text-center text-sm text-[var(--danger-foreground)]">{error}</p> : null}
          {!loading && !error && items.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-[var(--muted)]">
              <Inbox className="mx-auto mb-2 h-6 w-6" />
              暂无新通知
            </div>
          ) : null}
          {!loading && !error
            ? items.map((item) => {
                const meta = severityMeta[item.severity as keyof typeof severityMeta] ?? severityMeta.INFO;
                const Icon = meta.icon;

                return (
                  <DropdownMenuItem
                    key={item.id}
                    aria-label={item.readAt ? item.title : `${item.title}，未读`}
                    className="items-start gap-3 rounded-xl px-3 py-3"
                    onSelect={(event) => {
                      event.preventDefault();
                      void openNotification(item);
                    }}
                  >
                    <span className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${meta.className}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-start gap-2">
                        <span className="line-clamp-1 flex-1 text-sm font-semibold text-[var(--foreground)]">{item.title}</span>
                        {!item.readAt ? <span aria-hidden="true" className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--danger-foreground)]" /> : null}
                      </span>
                      {item.body ? <span className="mt-1 line-clamp-2 block text-xs leading-5 text-[var(--muted)]">{item.body}</span> : null}
                      <span className="mt-1 block text-xs text-[var(--muted)]">{formatRelativeTime(item.createdAt)}</span>
                    </span>
                  </DropdownMenuItem>
                );
              })
            : null}
        </div>

        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuItem
          className="justify-center rounded-none px-4 py-3 text-sm font-semibold text-[var(--brand)]"
          onSelect={(event) => {
            event.preventDefault();
            router.push("/admin/notifications");
          }}
        >
          查看全部通知
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
