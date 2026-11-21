"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import useSWR from "swr";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/admin/ui";
import { adminIconButtonClassName, adminTextActionClassName } from "@/components/admin/primitives/admin-classes";
import { SkeletonBar } from "@/components/editorial";
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

/** 严重级别：去掉彩色图标块，改为 meta 行里的语气色文字（错误 / 提醒 / 完成 / 信息） */
const severityMeta = {
  SUCCESS: { label: "完成", className: "text-[var(--success)]" },
  WARNING: { label: "提醒", className: "text-[var(--warning)]" },
  ERROR: { label: "错误", className: "text-[var(--danger-foreground)]" },
  INFO: { label: "信息", className: "text-[var(--focus)]" },
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
        <button aria-label={label} className={adminIconButtonClassName} type="button">
          <Bell aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />
          {unreadCount > 0 ? (
            <span
              aria-hidden="true"
              className="absolute top-0.5 right-px inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--danger-foreground)] px-1 font-mono text-[10px] leading-4 font-bold text-[var(--card-bg)]"
            >
              {formatUnreadCount(unreadCount)}
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[min(92vw,390px)] p-0">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
          <div>
            <p className="font-serif text-base font-bold text-[var(--foreground)]">通知</p>
            <p className="text-xs text-[var(--text-muted)]">{unreadCount > 0 ? `${unreadCount} 条未读` : "全部已读"}</p>
          </div>
          <button className={adminTextActionClassName} disabled={unreadCount === 0} onClick={() => void markAllRead()} type="button">
            全部已读
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto">
          {loading ? (
            <div aria-busy="true" className="space-y-2 px-4 py-4" role="status">
              <span className="ed-visually-hidden">正在加载通知...</span>
              <SkeletonBar strong className="h-3.5 w-1/2" />
              <SkeletonBar className="h-3 w-4/5" />
              <SkeletonBar className="h-3 w-24" />
            </div>
          ) : null}
          {!loading && error ? <p className="px-4 py-4 text-[0.8125rem] text-[var(--danger-foreground)]" role="alert">{error}</p> : null}
          {!loading && !error && items.length === 0 ? (
            <p className="px-4 py-5 font-serif text-[0.9375rem] font-bold text-[var(--foreground)]">暂无新通知</p>
          ) : null}
          {!loading && !error
            ? items.map((item) => {
                const meta = severityMeta[item.severity as keyof typeof severityMeta] ?? severityMeta.INFO;
                const isUnread = !item.readAt;

                return (
                  <DropdownMenuItem
                    key={item.id}
                    aria-label={item.readAt ? item.title : `${item.title}，未读`}
                    className="min-h-0 items-start gap-2.5 rounded-none border-b border-[var(--border)] px-4 py-3 last:border-b-0 focus:bg-[color-mix(in_oklab,var(--foreground)_4%,transparent)]"
                    onSelect={(event) => {
                      event.preventDefault();
                      void openNotification(item);
                    }}
                  >
                    {/* 未读：标题 700 + 左侧 6px danger 圆点；已读：标题 500 */}
                    <span
                      aria-hidden="true"
                      className={`mt-2 size-1.5 shrink-0 rounded-full transition-colors ${isUnread ? "bg-[var(--danger-foreground)]" : "bg-transparent"}`}
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className={`line-clamp-1 text-[0.875rem] text-[var(--foreground)] ${isUnread ? "font-bold" : "font-medium"}`}>{item.title}</span>
                      {item.body ? <span className="line-clamp-2 text-[0.8125rem] leading-5 text-[var(--text-muted)]">{item.body}</span> : null}
                      <span className="flex items-baseline gap-2 text-xs">
                        <span className={`font-bold ${meta.className}`}>{meta.label}</span>
                        <span className="font-mono text-[var(--text-muted)]">{formatRelativeTime(item.createdAt)}</span>
                      </span>
                    </span>
                  </DropdownMenuItem>
                );
              })
            : null}
        </div>

        <DropdownMenuSeparator className="m-0" />
        <DropdownMenuItem
          className="min-h-0 rounded-none px-4 py-3 text-[0.8125rem] font-bold text-[var(--text-body)] focus:bg-transparent focus:text-[var(--foreground)]"
          onSelect={(event) => {
            event.preventDefault();
            router.push("/admin/notifications");
          }}
        >
          <span className="underline decoration-[var(--reader-border-strong)] decoration-1 underline-offset-4">查看全部通知</span>
          <span aria-hidden="true">→</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
