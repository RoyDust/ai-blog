"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import useSWR from "swr";

import { ListTabs, MetricStrip } from "@/components/admin/lists";
import { adminHairlineRowClassName, adminTextActionClassName } from "@/components/admin/primitives/admin-classes";
import { AdminSectionHeader } from "@/components/admin/primitives/SectionHeader";
import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { Toolbar } from "@/components/admin/primitives/Toolbar";
import { Button } from "@/components/admin/ui";
import { EmptyState, SkeletonBar, editorialEase } from "@/components/editorial";
import { apiFetcher, apiMutate, handleGlobalSwrError, toErrorMessage } from "@/lib/client-api";

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

const filters: Array<{ value: NotificationFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "unread", label: "未读" },
  { value: "comment", label: "评论" },
  { value: "ai", label: "AI" },
  { value: "system", label: "系统" },
];

// 严重程度：语气色文字（不再是彩色图标块）
const severityMeta = {
  SUCCESS: { tone: "success", label: "成功" },
  WARNING: { tone: "warning", label: "警告" },
  ERROR: { tone: "danger", label: "错误" },
  INFO: { tone: "info", label: "信息" },
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unreadIds = useMemo(() => items.filter((item) => !item.readAt).map((item) => item.id), [items]);

  // 列表请求交给 SWR（筛选变化自动重取）；onSuccess 把数据同步进本地状态，
  // 已读操作需要本地乐观更新（GET 响应可能滞后于 PATCH 结果）。
  const { isLoading, mutate } = useSWR<{ success?: boolean; data?: NotificationPayload }>(
    buildNotificationUrl(activeFilter),
    apiFetcher,
    {
      revalidateOnFocus: true,
      onSuccess: (data) => {
        setItems(data?.data?.items ?? []);
        setUnreadCount(data?.data?.unreadCount ?? 0);
        setNextCursor(data?.data?.nextCursor ?? null);
      },
      onError: (loadError, key) => {
        handleGlobalSwrError(loadError, key);
        setError(toErrorMessage(loadError, "通知加载失败"));
      },
    },
  );
  const loading = isLoading;

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
      const data = await apiFetcher<{ success?: boolean; data?: NotificationPayload }>(buildNotificationUrl(activeFilter, nextCursor));
      const payload = data.data;
      if (!payload) {
        throw new Error("通知加载失败");
      }

      setItems((current) => [...current, ...payload.items]);
      setUnreadCount(payload.unreadCount);
      setNextCursor(payload.nextCursor);
    } catch (loadError) {
      setError(toErrorMessage(loadError, "通知加载失败"));
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

    const payload = await apiMutate<{ success?: boolean; data?: { unreadCount: number } }>("/api/admin/notifications", {
      method: "PATCH",
      body: JSON.stringify({ action: "read", ids }),
    });
    if (!payload.data) {
      throw new Error("通知状态更新失败");
    }

    setUnreadCount(payload.data.unreadCount);
    setItems((current) => current.map((item) => (ids.includes(item.id) ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item)));
    void mutate();
  }, [mutate]);

  /**
   * 将当前账号的所有通知标记为已读。
   */
  const markAllRead = useCallback(async () => {
    try {
      const payload = await apiMutate<{ success?: boolean; data?: { unreadCount: number } }>("/api/admin/notifications/read-all", { method: "POST" });
      if (!payload.data) {
        setError("通知状态更新失败");
        return;
      }

      setUnreadCount(payload.data.unreadCount);
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
      void mutate();
    } catch {
      setError("通知状态更新失败");
    }
  }, [mutate]);

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

  const reduceMotion = useReducedMotion();

  const renderList = () => {
    if (loading) {
      return (
        <div aria-busy="true">
          <span className="ed-visually-hidden" role="status">
            正在加载通知...
          </span>
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} aria-hidden="true" className="flex items-center gap-4 border-b border-[var(--border)] py-4">
              <SkeletonBar className="h-3 w-8" />
              <div className="flex-1 space-y-2">
                <SkeletonBar strong className="h-3.5 w-[38%]" />
                <SkeletonBar className="h-3 w-[64%]" />
              </div>
              <SkeletonBar className="h-3 w-20" />
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <EmptyState
          actions={
            <Button onClick={() => { setError(null); void mutate(); }} size="sm" type="button" variant="outline">
              重试
            </Button>
          }
          role="alert"
          title={error}
          tone="danger"
        />
      );
    }

    if (items.length === 0) {
      return <EmptyState description="切换筛选查看其他通知。" role="status" title="暂无匹配通知。" />;
    }

    return (
      <div>
        {items.map((item, index) => {
          const meta = severityMeta[item.severity as keyof typeof severityMeta] ?? severityMeta.INFO;
          const unread = !item.readAt;

          return (
            <motion.article
              key={item.id}
              animate={{ opacity: 1, y: 0 }}
              className={`${adminHairlineRowClassName} grid grid-cols-[3rem_minmax(0,1fr)] items-start gap-x-4 gap-y-2 py-3.5 sm:grid-cols-[3rem_minmax(0,1fr)_auto]`}
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              transition={{ duration: 0.3, ease: editorialEase, delay: reduceMotion ? 0 : Math.min(index, 8) * 0.03 }}
            >
              <StatusBadge className="pt-1" tone={meta.tone}>
                {meta.label}
              </StatusBadge>
              <div className="min-w-0">
                <div className="flex min-w-0 items-baseline gap-2">
                  <h3 className={`truncate font-serif text-[0.9375rem] font-bold ${unread ? "text-[var(--foreground)]" : "text-[var(--text-body)]"}`}>{item.title}</h3>
                  {unread ? <span className="shrink-0 text-xs font-bold text-[var(--focus)]">未读</span> : null}
                </div>
                {item.body ? <p className="mt-0.5 truncate text-[0.8125rem] text-[var(--text-muted)]" title={item.body}>{item.body}</p> : null}
              </div>
              <div className="col-start-2 flex shrink-0 items-center gap-4 sm:col-start-3">
                <span className="font-mono text-xs text-[var(--text-muted)] tabular-nums">{formatDate(item.createdAt)}</span>
                {unread ? (
                  <button className={adminTextActionClassName} onClick={() => void markRead([item.id])} type="button">
                    已读
                  </button>
                ) : null}
                {item.actionUrl ? (
                  <button className={adminTextActionClassName} onClick={() => void openNotification(item)} type="button">
                    查看
                  </button>
                ) : null}
              </div>
            </motion.article>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      <MetricStrip
        ariaLabel="通知概况"
        className="mt-1"
        items={[
          {
            key: "unread",
            label: "未读",
            value: unreadCount.toLocaleString("zh-CN"),
            note: "点击只看未读",
            tone: unreadCount > 0 ? "info" : "default",
            pressed: activeFilter === "unread",
            onSelect: () => setActiveFilter(activeFilter === "unread" ? "all" : "unread"),
          },
          { key: "loaded", label: "当前列表", value: items.length.toLocaleString("zh-CN"), note: nextCursor ? "还有更多，可继续加载" : "已全部加载" },
          { key: "page-unread", label: "本页未读", value: unreadIds.length.toLocaleString("zh-CN"), note: "可一键标记已读" },
        ]}
      />

      <section aria-labelledby="admin-notifications-title" className="mt-6">
        <AdminSectionHeader
          aside={
            <>
              <span>{unreadCount > 0 ? `${unreadCount} 条未读` : "当前没有未读通知"}</span>
              {unreadIds.length > 0 ? (
                <button className={adminTextActionClassName} onClick={() => void markRead(unreadIds)} type="button">
                  标记当前页已读
                </button>
              ) : null}
            </>
          }
          description="评论、AI 任务和系统状态"
          id="admin-notifications-title"
          title="通知列表"
        />

        <Toolbar
          leading={<ListTabs ariaLabel="通知筛选" items={filters} onChange={setActiveFilter} value={activeFilter} />}
          trailing={
            <Button disabled={unreadCount === 0} onClick={() => void markAllRead()} size="sm" type="button" variant="outline">
              全部已读
            </Button>
          }
        />

        <div className="border-t border-[var(--reader-border-strong)]">{renderList()}</div>

        {!loading && !error && nextCursor ? (
          <div className="pt-4">
            <Button disabled={loadingMore} onClick={() => void loadMore()} size="sm" type="button" variant="outline">
              {loadingMore ? "加载中..." : "加载更多"}
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
