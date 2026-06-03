"use client";

/**
 * 后台文章列表页。
 *
 * 职责：
 * - 展示文章列表、摘要状态、发布状态与基础统计
 * - 提供搜索、状态过滤、发布切换、隐藏删除、批量 AI 补全等操作
 * - 在摘要任务进行中时，周期性同步任务状态
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Eye, FileText, PenLine } from "lucide-react";
import { DataTable, type DataColumn } from "@/components/admin/DataTable";
import { DeleteImpactDialog, type DeleteImpactItem } from "@/components/admin/DeleteImpactDialog";
import { BulkAiCompletionDialog } from "@/components/admin/ai/BulkAiCompletionDialog";
import { Toolbar } from "@/components/admin/primitives/Toolbar";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { Button } from "@/components/admin/ui";
import {
  getSummaryStatusForExcerpt,
  isActiveSummaryStatus,
  type PostSummaryStatus,
} from "@/lib/post-summary-status";
import { getApiErrorMessage } from "@/lib/admin-api-client";

interface PostRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  summaryStatus?: PostSummaryStatus | null;
  summaryError?: string | null;
  summaryGeneratedAt?: string | null;
  summaryJobId?: string | null;
  summaryModelId?: string | null;
  published: boolean;
  viewCount: number;
  createdAt: string;
  author: { name: string | null; email: string };
  _count: { comments: number; likes: number };
}

interface DeleteDialogState {
  open: boolean;
  ids: string[];
  title: string;
  description: string;
  impacts: DeleteImpactItem[];
  submitting: boolean;
}

const initialDeleteDialog: DeleteDialogState = {
  open: false,
  ids: [],
  title: "",
  description: "",
  impacts: [],
  submitting: false,
};

const defaultPageSize = 10;

type PaginationState = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type PostStats = {
  total: number;
  published: number;
  drafts: number;
  views: number;
};

const emptyPagination: PaginationState = {
  page: 1,
  limit: defaultPageSize,
  total: 0,
  totalPages: 1,
};

const emptyStats: PostStats = {
  total: 0,
  published: 0,
  drafts: 0,
  views: 0,
};

function getSummaryStatus(post: PostRow): PostSummaryStatus {
  if (post.summaryStatus) {
    return post.summaryStatus;
  }

  return getSummaryStatusForExcerpt(post.excerpt);
}

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  scheme: "blue" | "emerald" | "amber" | "violet";
  hint?: string;
  onClick?: () => void;
  active?: boolean;
}

function StatsCard({ label, value, icon: Icon, scheme, hint, onClick, active }: StatsCardProps) {
  const schemeStyles = {
    blue: {
      bg: "bg-blue-50 dark:bg-blue-950/30",
      text: "text-blue-600 dark:text-blue-400",
      border: "border-blue-100 dark:border-blue-900/30",
      ring: "ring-2 ring-blue-500/50 border-blue-500/50",
    },
    emerald: {
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      text: "text-emerald-600 dark:text-emerald-400",
      border: "border-emerald-100 dark:border-emerald-900/30",
      ring: "ring-2 ring-emerald-500/50 border-emerald-500/50",
    },
    amber: {
      bg: "bg-amber-50 dark:bg-amber-950/30",
      text: "text-amber-600 dark:text-amber-400",
      border: "border-amber-100 dark:border-amber-900/30",
      ring: "ring-2 ring-amber-500/50 border-amber-500/50",
    },
    violet: {
      bg: "bg-violet-50 dark:bg-violet-950/30",
      text: "text-violet-600 dark:text-violet-400",
      border: "border-violet-100 dark:border-violet-900/30",
      ring: "ring-2 ring-violet-500/50 border-violet-500/50",
    },
  }[scheme];

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
      className={`relative overflow-hidden rounded-lg border bg-[var(--surface)] p-4 shadow-sm transition-all duration-200
        ${onClick ? "cursor-pointer hover:shadow-md select-none" : ""}
        ${active ? `${schemeStyles.ring}` : "border-[var(--border)] dark:hover:border-blue-500/20"}
        group`}
    >
      <div className="flex items-center justify-between">
        <dt className="text-xs font-semibold text-[var(--muted)] tracking-wide uppercase">
          {label}
        </dt>
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${schemeStyles.bg} ${schemeStyles.text} ${schemeStyles.border} border transition-all duration-300 group-hover:scale-110 shadow-sm`}>
          <Icon className="h-4.5 w-4.5" aria-hidden />
        </span>
      </div>
      <dd className="mt-2 text-2xl font-bold tracking-tight text-[var(--foreground)] font-mono">
        {typeof value === "number" ? value.toLocaleString("zh-CN") : value}
      </dd>
      {hint ? (
        <p className="mt-2 text-[10px] font-medium text-[var(--muted)] border-t border-[var(--border)] pt-1.5">
          {hint}
        </p>
      ) : (
        <p className="mt-2 text-[10px] font-medium text-emerald-500 border-t border-[var(--border)] pt-1.5 flex items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
          运行正常
        </p>
      )}
    </div>
  );
}

/**
 * 后台文章管理主页面。
 * 这里负责协调列表数据、批量操作弹窗与行级异步动作状态。
 */
export default function AdminPostsPage() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [pagination, setPagination] = useState<PaginationState>(emptyPagination);
  const [stats, setStats] = useState<PostStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [busyRowIds, setBusyRowIds] = useState<string[]>([]);
  const [bulkPublishAction, setBulkPublishAction] = useState<"publish" | "draft" | null>(null);
  const [bulkAiIds, setBulkAiIds] = useState<string[]>([]);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>(initialDeleteDialog);

  /**
   * 拉取后台文章列表。
   * 是本页所有刷新动作的统一入口。
   */
  const fetchPosts = useCallback(async (options: { silent?: boolean } = {}) => {
    try {
      if (!options.silent) {
        setLoading(true);
      }
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      const keyword = debouncedQuery.trim();
      if (keyword) params.set("q", keyword);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/admin/posts?${params.toString()}`);
      const data = await res.json();
      if (data?.success && Array.isArray(data.data)) {
        const nextPagination = data.pagination ?? {
          page,
          limit: pageSize,
          total: data.data.length,
          totalPages: Math.max(1, Math.ceil(data.data.length / pageSize)),
        };
        setPosts(data.data);
        setPagination(nextPagination);
        setStats(data.stats ?? emptyStats);
        if (nextPagination.page !== page) {
          setPage(nextPagination.page);
        }
        return;
      }

      toast.error(getApiErrorMessage(data, "文章列表加载失败"));
      setPosts([]);
      setPagination({ ...emptyPagination, limit: pageSize });
      setStats(emptyStats);
    } catch {
      toast.error("文章列表加载失败，请稍后重试");
      setPosts([]);
      setPagination({ ...emptyPagination, limit: pageSize });
      setStats(emptyStats);
    } finally {
      if (!options.silent) {
        setLoading(false);
      }
    }
  }, [debouncedQuery, page, pageSize, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    void fetchPosts();
  }, [fetchPosts]);

  const activeSummaryIds = useMemo(
    () => posts.filter((post) => isActiveSummaryStatus(getSummaryStatus(post))).map((post) => post.id),
    [posts],
  );

  const syncSummaryJobs = useCallback(async () => {
    try {
      await fetch("/api/admin/posts/summarize/bulk?resume=1");
      await fetchPosts({ silent: true });
    } catch {
      toast.error("摘要任务状态同步失败");
    }
  }, [fetchPosts]);

  useEffect(() => {
    if (activeSummaryIds.length === 0) {
      return;
    }

    let cancelled = false;
    const sync = async () => {
      try {
        await fetch("/api/admin/posts/summarize/bulk?resume=1");
        if (!cancelled) {
          await fetchPosts({ silent: true });
        }
      } catch {
        if (!cancelled) {
          toast.error("摘要任务状态同步失败");
        }
      }
    };
    const timer = window.setInterval(() => {
      void sync();
    }, 2500);

    void sync();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeSummaryIds.length, fetchPosts]);

  /**
   * 打开删除影响预览弹窗。
   * 先请求服务端返回影响说明，再允许用户确认删除文章。
   */
  async function openDeleteDialog(ids: string[]) {
    try {
      const params = new URLSearchParams({ preview: "delete", ids: ids.join(",") });
      const res = await fetch(`/api/admin/posts?${params.toString()}`);
      const data = await res.json();

      if (!data.success) {
        toast.error(getApiErrorMessage(data, "删除影响预览加载失败"));
        return;
      }

      setDeleteDialog({
        open: true,
        ids,
        title: data.data.title,
        description: data.data.description,
        impacts: data.data.impacts,
        submitting: false,
      });
    } catch {
      toast.error("删除影响预览加载失败，请稍后重试");
    }
  }

  /**
   * 确认删除文章。
   * 这里走的是软删除 / 隐藏语义，不直接物理删除数据库记录。
   */
  async function confirmDelete() {
    try {
      setDeleteDialog((prev) => ({ ...prev, submitting: true }));
      const params = new URLSearchParams({ ids: deleteDialog.ids.join(",") });
      const res = await fetch(`/api/admin/posts?${params.toString()}`, { method: "DELETE" });
      const data = await res.json();

      if (data.success) {
        setDeleteDialog(initialDeleteDialog);
        toast.success(deleteDialog.ids.length > 1 ? `已删除 ${deleteDialog.ids.length} 篇文章` : "文章已删除");
        void fetchPosts({ silent: true });
        return;
      }

      toast.error(getApiErrorMessage(data, "删除文章失败"));
    } catch {
      toast.error("删除文章失败，请稍后重试");
    }

    setDeleteDialog((prev) => ({ ...prev, submitting: false }));
  }

  /**
   * 切换单篇文章的发布状态。
   * 采用乐观更新：先更新本地 UI，再在失败时回滚。
   */
  async function togglePublish(row: PostRow) {
    if (busyRowIds.includes(row.id)) {
      return;
    }

    const nextPublished = !row.published;
    setBusyRowIds((prev) => [...prev, row.id]);
    setPosts((prev) => prev.map((item) => (item.id === row.id ? { ...item, published: nextPublished } : item)));

    try {
      const res = await fetch("/api/admin/posts/publish", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, published: nextPublished }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(getApiErrorMessage(data, "更新发布状态失败"));
      }

      toast.success(nextPublished ? "文章已发布" : "已转为草稿");
      void fetchPosts({ silent: true });
    } catch (error) {
      setPosts((prev) => prev.map((item) => (item.id === row.id ? { ...item, published: row.published } : item)));
      toast.error(error instanceof Error ? error.message : "更新发布状态失败");
    } finally {
      setBusyRowIds((prev) => prev.filter((id) => id !== row.id));
    }
  }

  /**
   * 批量切换文章发布状态。
   * 批量发布只处理草稿，批量转草稿只处理已发布文章，避免无意刷新发布时间。
   */
  async function updateBulkPublish(ids: string[], published: boolean) {
    if (bulkPublishAction) {
      return;
    }

    const targetRows = posts.filter((post) => ids.includes(post.id) && post.published !== published);
    const targetIds = targetRows.map((post) => post.id);

    if (targetIds.length === 0) {
      toast.info(published ? "所选文章已全部发布" : "所选文章已全部是草稿");
      return;
    }

    const previousPosts = posts;
    const action = published ? "publish" : "draft";
    setBulkPublishAction(action);
    setBusyRowIds((prev) => Array.from(new Set([...prev, ...targetIds])));
    setPosts((prev) => prev.map((item) => (targetIds.includes(item.id) ? { ...item, published } : item)));

    try {
      const res = await fetch("/api/admin/posts/publish", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: targetIds, published }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(getApiErrorMessage(data, published ? "批量发布失败" : "批量转草稿失败"));
      }

      const count = data.data?.count ?? targetIds.length;
      toast.success(published ? `已发布 ${count} 篇文章` : `已将 ${count} 篇文章转为草稿`);
      void fetchPosts({ silent: true });
    } catch (error) {
      setPosts(previousPosts);
      toast.error(error instanceof Error ? error.message : published ? "批量发布失败" : "批量转草稿失败");
    } finally {
      setBulkPublishAction(null);
      setBusyRowIds((prev) => prev.filter((id) => !targetIds.includes(id)));
    }
  }

  const columns: DataColumn<PostRow>[] = [
    {
      key: "title",
      label: "标题",
      render: (row) => (
        <div className="space-y-1">
          <Link className="font-medium text-[var(--foreground)] hover:text-[var(--brand)]" href={`/admin/posts/${row.id}/edit`}>
            {row.title}
          </Link>
          <p className="text-xs text-[var(--muted)]">/posts/{row.slug}</p>
        </div>
      ),
    },
    { key: "author", label: "作者", render: (row) => row.author.name || row.author.email },
    {
      key: "excerpt",
      label: "摘要",
      render: (row) => {
        const summaryStatus = getSummaryStatus(row);

        if (summaryStatus === "QUEUED") {
          return <StatusBadge tone="warning">排队中</StatusBadge>;
        }

        if (summaryStatus === "GENERATING") {
          return <StatusBadge tone="warning">生成中</StatusBadge>;
        }

        if (summaryStatus === "FAILED") {
          return (
            <div className="max-w-[260px] space-y-1">
              <StatusBadge tone="danger">生成失败</StatusBadge>
              {row.summaryError ? <p className="line-clamp-2 text-xs leading-5 text-rose-600">{row.summaryError}</p> : null}
              {row.excerpt?.trim() ? <p className="line-clamp-2 text-xs leading-5 text-[var(--muted)]">{row.excerpt}</p> : null}
            </div>
          );
        }

        if (!row.excerpt?.trim()) {
          return <StatusBadge>未生成</StatusBadge>;
        }

        return (
          <div className="max-w-[260px] space-y-1">
            <StatusBadge tone="success">{summaryStatus === "GENERATED" ? "已生成" : "已填写"}</StatusBadge>
            <p className="line-clamp-2 text-xs leading-5 text-[var(--muted)]">{row.excerpt}</p>
          </div>
        );
      },
    },
    {
      key: "status",
      label: "状态",
      render: (row) => (
        <div className="space-y-2">
          <StatusBadge tone={row.published ? "success" : "warning"}>{row.published ? "已发布" : "草稿"}</StatusBadge>
          <Button
            size="sm"
            type="button"
            variant={row.published ? "outline" : "secondary"}
            disabled={busyRowIds.includes(row.id)}
            onClick={() => void togglePublish(row)}
          >
            {row.published ? "切换为草稿" : "切换为已发布"}
          </Button>
        </div>
      ),
    },
    {
      key: "stats",
      label: "上下文",
      render: (row) => (
        <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
          <span>阅读 {row.viewCount}</span>
          <span>评论 {row._count.comments}</span>
          <span>点赞 {row._count.likes}</span>
        </div>
      ),
    },
    { key: "createdAt", label: "创建时间", render: (row) => new Date(row.createdAt).toLocaleDateString("zh-CN") },
    {
      key: "actions",
      label: "操作",
      render: (row) => (
        <div className="flex items-center gap-3 text-sm">
          <Link className="text-[var(--brand)] hover:underline" href={`/admin/posts/${row.id}/edit`}>
            编辑
          </Link>
          <Link className="text-[var(--foreground)] hover:text-[var(--brand)]" href={row.published ? `/posts/${row.slug}` : `/posts/${row.slug}?preview=admin`}>
            预览
          </Link>
          <button className="text-rose-600 hover:underline" onClick={() => void openDeleteDialog([row.id])} type="button">
            删除
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="flex h-full min-h-0 flex-col gap-4 overflow-hidden">
        <div className="shrink-0">
          <PageHeader
            eyebrow="Content"
            title="内容队列"
            description="围绕草稿、发布和复盘组织文章操作。"
            action={
              <Link href="/admin/posts/new">
                <Button size="sm">新建文章</Button>
              </Link>
            }
          />
        </div>

        <div className="grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            label="全部内容"
            value={stats.total}
            icon={FileText}
            scheme="blue"
            hint="点击快速过滤全部内容"
            onClick={() => {
              setStatusFilter("all");
              setPage(1);
            }}
            active={statusFilter === "all"}
          />
          <StatsCard
            label="已发布"
            value={stats.published}
            icon={CheckCircle2}
            scheme="emerald"
            hint="点击快速过滤已发布内容"
            onClick={() => {
              setStatusFilter("published");
              setPage(1);
            }}
            active={statusFilter === "published"}
          />
          <StatsCard
            label="草稿箱"
            value={stats.drafts}
            icon={PenLine}
            scheme="amber"
            hint="点击快速过滤草稿内容"
            onClick={() => {
              setStatusFilter("draft");
              setPage(1);
            }}
            active={statusFilter === "draft"}
          />
          <StatsCard
            label="总阅读量"
            value={stats.views}
            icon={Eye}
            scheme="violet"
            hint="所有文章累计阅读数"
          />
        </div>

        <div className="shrink-0">
          <Toolbar
            leading={
              <>
                <input
                  aria-label="搜索文章"
                  className="ui-ring min-w-[240px] flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                  placeholder="搜索标题或 slug"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                />
                {[
                  { key: "all", label: "全部内容" },
                  { key: "draft", label: "仅看草稿" },
                  { key: "published", label: "已发布" },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    aria-pressed={statusFilter === item.key}
                    className={
                      statusFilter === item.key
                        ? "ui-btn rounded-xl bg-[var(--primary)] px-3 py-2 text-sm text-white"
                        : "ui-btn rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
                    }
                    onClick={() => {
                      setStatusFilter(item.key as typeof statusFilter);
                      setPage(1);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </>
            }
            trailing={<span className="text-sm text-[var(--muted)]">共 {pagination.total} 篇内容</span>}
          />
        </div>

        <DataTable
          fillHeight
          title="文章列表"
          summary="按内容状态和发布时间组织内容队列。"
          densityLabel="内容队列"
          toolbar={
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
              <span>支持批量 AI 摘要、封面生成、内容补全、发布、转草稿与删除</span>
              {bulkPublishAction ? (
                <StatusBadge tone="warning">{bulkPublishAction === "publish" ? "批量发布处理中" : "批量转草稿处理中"}</StatusBadge>
              ) : null}
              {activeSummaryIds.length > 0 ? <StatusBadge tone="warning">{activeSummaryIds.length} 篇摘要处理中</StatusBadge> : null}
            </div>
          }
          isLoading={loading}
          loadingLabel="正在加载内容队列..."
          bulkActions={[
            {
              label: "AI 批量补全",
              disabled: bulkPublishAction !== null,
              onClick: (ids) => setBulkAiIds(ids),
            },
            {
              label: "批量发布",
              disabled: bulkPublishAction !== null,
              onClick: (ids) => void updateBulkPublish(ids, true),
            },
            {
              label: "批量转草稿",
              disabled: bulkPublishAction !== null,
              onClick: (ids) => void updateBulkPublish(ids, false),
            },
            {
              label: "批量删除",
              variant: "danger",
              disabled: bulkPublishAction !== null,
              onClick: (ids) => void openDeleteDialog(ids),
            },
          ]}
          columns={columns}
          emptyText="暂无文章"
          rows={posts}
          pagination={pagination}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
        />
      </div>

      <DeleteImpactDialog
        confirmLabel="确认删除"
        description={deleteDialog.description}
        impacts={deleteDialog.impacts}
        onConfirm={confirmDelete}
        onOpenChange={(open) => setDeleteDialog(open ? deleteDialog : initialDeleteDialog)}
        open={deleteDialog.open}
        submitting={deleteDialog.submitting}
        title={deleteDialog.title}
      />

      <BulkAiCompletionDialog
        open={bulkAiIds.length > 0}
        selectedIds={bulkAiIds}
        onClose={() => setBulkAiIds([])}
        onStarted={(taskId) => {
          void fetch(`/api/admin/ai/batch?resume=1&taskId=${encodeURIComponent(taskId)}`);
          void fetchPosts();
          void syncSummaryJobs();
        }}
      />
    </>
  );
}
