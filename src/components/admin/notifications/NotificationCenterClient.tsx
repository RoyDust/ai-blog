"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Bell, CheckCheck, CircleCheck, Info, XCircle } from "lucide-react";

import { Button } from "@/components/admin/ui";
import { readApiJson } from "@/lib/admin-api-client";

type NotificationFilter = "all" | "unread" | "comment" | "ai" | "system";

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

const filters: Array<{ key: NotificationFilter; label: string }> = [
  { key: "all", label: "全部" },
  { key: "unread", label: "未读" },
  { key: "comment", label: "评论" },
  { key: "ai", label: "AI" },
  { key: "system", label: "系统" },
];

const severityMeta = {
  SUCCESS: { icon: CircleCheck, className: "bg-emerald-50 text-emerald-700", label: "成功" },
  WARNING: { icon: AlertCircle, className: "bg-amber-50 text-amber-700", label: "警告" },
  ERROR: { icon: XCircle, className: "bg-rose-50 text-rose-700", label: "错误" },
  INFO: { icon: Info, className: "bg-sky-50 text-sky-700", label: "信息" },
} as const;

/**
 * 根据列表筛选项拼出通知查询 URL。
 *
 * 顶部筛选的“未读”和业务分类最终映射到不同的查询参数；cursor 用于游标式加载更多。
 */
function buildNotificationUrl(filter: NotificationFilter, cursor?: string | null) {
  const params = new URLSearchParams();
  params.set("limit", "30");

  if (filter === "unread") {
    params.set("status", "unread");
  }

  if (filter === "comment" || filter === "ai" || filter === "system") {
    params.set("category", filter);
  }

  if (cursor) {
    params.set("cursor", cursor);
  }

  return `/api/admin/notifications?${params.toString()}`;
}

/**
 * 后台通知列表使用的绝对时间格式。
 */
function formatDate(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * 读取通知列表响应，并把缺少 data 的响应统一转成加载错误。
 */
async function readPayload(response: Response) {
  const payload = await readApiJson<{ success?: boolean; data?: NotificationPayload }>(response, "通知加载失败");
  if (!payload.data) {
    throw new Error("通知加载失败");
  }

  return payload.data;
}

/**
 * 通知中心完整列表页客户端。
 *
 * 相比顶部铃铛，这里负责筛选、批量已读当前页、全部已读和按通知跳转。
 */
export function NotificationCenterClient() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState<NotificationFilter>("all");
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unreadIds = useMemo(() => items.filter((item) => !item.readAt).map((item) => item.id), [items]);

  /**
   * 按当前筛选条件加载通知列表。
   *
   * 每次切换筛选都会重置 loading，避免用户把上一筛选条件的数据误认为当前结果。
   */
  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await readPayload(await fetch(buildNotificationUrl(activeFilter), { cache: "no-store" }));
      setItems(data.items);
      setUnreadCount(data.unreadCount);
      setNextCursor(data.nextCursor);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "通知加载失败");
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  /**
   * 游标式加载更多：把下一页通知追加到当前列表末尾。
   *
   * 服务端按 cursor 跳过已读取的最后一条，因此追加不会与现有项重复。
   */
  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) {
      return;
    }

    try {
      setLoadingMore(true);
      setError(null);
      const data = await readPayload(await fetch(buildNotificationUrl(activeFilter, nextCursor), { cache: "no-store" }));
      setItems((current) => [...current, ...data.items]);
      setUnreadCount(data.unreadCount);
      setNextCursor(data.nextCursor);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "通知加载失败");
    } finally {
      setLoadingMore(false);
    }
  }, [activeFilter, loadingMore, nextCursor]);

  /**
   * 标记一组通知为已读，并用后端返回的 unreadCount 同步全局未读数。
   */
  const markRead = useCallback(async (ids: string[]) => {
    if (ids.length === 0) {
      return;
    }

    const response = await fetch("/api/admin/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "read", ids }),
    });
    const payload = await readApiJson<{ success?: boolean; data?: { unreadCount: number } }>(response, "通知状态更新失败");
    if (!payload.data) {
      throw new Error("通知状态更新失败");
    }

    setUnreadCount(payload.data.unreadCount);
    setItems((current) => current.map((item) => (ids.includes(item.id) ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item)));
  }, []);

  /**
   * 将当前账号的所有通知标记为已读。
   */
  const markAllRead = useCallback(async () => {
    const response = await fetch("/api/admin/notifications/read-all", { method: "POST" });
    const payload = await readApiJson<{ success?: boolean; data?: { unreadCount: number } }>(response, "通知状态更新失败").catch(() => null);
    if (!payload?.data) {
      setError("通知状态更新失败");
      return;
    }

    setUnreadCount(payload.data.unreadCount);
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
  }, []);

  /**
   * 进入通知关联页面前先补齐已读状态，保证返回列表时角标已经收敛。
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
        setError(openError instanceof Error ? openError.message : "通知状态更新失败");
      }
    },
    [markRead, router],
  );

  return (
    <div className="space-y-4">
      <section className="ui-surface rounded-3xl px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {filters.map((filter) => {
              const active = filter.key === activeFilter;
              return (
                <button
                  key={filter.key}
                  className={
                    active
                      ? "ui-btn rounded-xl bg-[var(--primary)] px-3 py-2 text-sm text-white"
                      : "ui-btn rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
                  }
                  onClick={() => setActiveFilter(filter.key)}
                  type="button"
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
          <Button className="gap-2" disabled={unreadCount === 0} onClick={() => void markAllRead()} size="sm" type="button" variant="outline">
            <CheckCheck className="h-4 w-4" />
            全部已读
          </Button>
        </div>
      </section>

      <section className="ui-surface overflow-hidden rounded-3xl">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-[var(--brand)]">
              <Bell className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-[var(--foreground)]">通知列表</h2>
              <p className="text-sm text-[var(--muted)]">{unreadCount > 0 ? `${unreadCount} 条未读` : "当前没有未读通知"}</p>
            </div>
          </div>
          {unreadIds.length > 0 ? (
            <button className="text-sm font-medium text-[var(--brand)]" onClick={() => void markRead(unreadIds)} type="button">
              标记当前页已读
            </button>
          ) : null}
        </div>

        {loading ? <p className="px-5 py-10 text-center text-sm text-[var(--muted)]">正在加载通知...</p> : null}
        {!loading && error ? <p className="px-5 py-10 text-center text-sm text-rose-600">{error}</p> : null}
        {!loading && !error && items.length === 0 ? <p className="px-5 py-10 text-center text-sm text-[var(--muted)]">暂无匹配通知。</p> : null}
        {!loading && !error && items.length > 0 ? (
          <div className="divide-y divide-[var(--border)]">
            {items.map((item) => {
              const meta = severityMeta[item.severity as keyof typeof severityMeta] ?? severityMeta.INFO;
              const Icon = meta.icon;

              return (
                <article key={item.id} className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-start">
                  <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.className}`}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-[var(--foreground)]">{item.title}</h3>
                      <span className="rounded-full bg-[var(--surface-alt)] px-2.5 py-1 text-xs text-[var(--muted)]">{meta.label}</span>
                      {!item.readAt ? <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-600">未读</span> : null}
                    </div>
                    {item.body ? <p className="mt-2 text-sm leading-6 text-[var(--text-body)]">{item.body}</p> : null}
                    <p className="mt-2 text-xs text-[var(--muted)]">{formatDate(item.createdAt)}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {!item.readAt ? (
                      <Button onClick={() => void markRead([item.id])} size="sm" type="button" variant="outline">
                        已读
                      </Button>
                    ) : null}
                    {item.actionUrl ? (
                      <Button onClick={() => void openNotification(item)} size="sm" type="button">
                        查看
                      </Button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}

        {!loading && !error && nextCursor ? (
          <div className="border-t border-[var(--border)] px-5 py-4 text-center">
            <Button disabled={loadingMore} onClick={() => void loadMore()} size="sm" type="button" variant="outline">
              {loadingMore ? "加载中..." : "加载更多"}
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
