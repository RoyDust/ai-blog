"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { DataTable, type DataColumn } from "@/components/admin/DataTable";
import { DeleteImpactDialog, type DeleteImpactItem } from "@/components/admin/DeleteImpactDialog";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { Toolbar } from "@/components/admin/primitives/Toolbar";
import { getApiErrorMessage } from "@/lib/admin-api-client";
import { CheckCircle2, Clock, MessageSquare, XCircle } from "lucide-react";

type CommentStatus = "APPROVED" | "PENDING" | "REJECTED" | "SPAM";

interface CommentRow {
  id: string;
  content: string;
  createdAt: string;
  status: CommentStatus;
  author: { name: string | null; email: string } | null;
  authorLabel?: string | null;
  post: { title: string; slug: string };
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

const statusMeta: Record<CommentStatus, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  APPROVED: { label: "已通过", tone: "success" },
  PENDING: { label: "待审核", tone: "warning" },
  REJECTED: { label: "已驳回", tone: "danger" },
  SPAM: { label: "已隐藏", tone: "neutral" },
};

const defaultPageSize = 10;

type PaginationState = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type CommentStats = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  spam: number;
};

const emptyPagination: PaginationState = {
  page: 1,
  limit: defaultPageSize,
  total: 0,
  totalPages: 1,
};

const emptyStats: CommentStats = {
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
  spam: 0,
};

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  scheme: "blue" | "emerald" | "amber" | "rose";
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
    rose: {
      bg: "bg-rose-50 dark:bg-rose-950/30",
      text: "text-rose-600 dark:text-rose-400",
      border: "border-rose-100 dark:border-rose-900/30",
      ring: "ring-2 ring-rose-500/50 border-rose-500/50",
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

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [pagination, setPagination] = useState<PaginationState>(emptyPagination);
  const [stats, setStats] = useState<CommentStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | CommentStatus>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>(initialDeleteDialog);

  const fetchComments = useCallback(async (options: { silent?: boolean } = {}) => {
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
      if (statusFilter !== "ALL") params.set("status", statusFilter);

      const res = await fetch(`/api/admin/comments?${params.toString()}`);
      const data = await res.json();
      if (data?.success && Array.isArray(data.data)) {
        const nextPagination = data.pagination ?? {
          page,
          limit: pageSize,
          total: data.data.length,
          totalPages: Math.max(1, Math.ceil(data.data.length / pageSize)),
        };
        setComments(data.data);
        setPagination(nextPagination);
        setStats(data.stats ?? emptyStats);
        if (nextPagination.page !== page) {
          setPage(nextPagination.page);
        }
        return;
      }

      toast.error(getApiErrorMessage(data, "评论列表加载失败"));
      setComments([]);
      setPagination({ ...emptyPagination, limit: pageSize });
      setStats(emptyStats);
    } catch {
      toast.error("评论列表加载失败，请稍后重试");
      setComments([]);
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
    void fetchComments();
  }, [fetchComments]);

  async function updateStatuses(ids: string[], status: CommentStatus) {
    try {
      const res = await fetch("/api/admin/comments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status }),
      });
      const data = await res.json();

      if (data?.success) {
        setComments((prev) => prev.map((item) => (ids.includes(item.id) ? { ...item, status } : item)));
        toast.success(ids.length > 1 ? `已更新 ${ids.length} 条评论状态` : "评论状态已更新");
        void fetchComments({ silent: true });
        return;
      }

      toast.error(getApiErrorMessage(data, "评论状态更新失败"));
    } catch {
      toast.error("评论状态更新失败，请稍后重试");
    }
  }

  async function openDeleteDialog(ids: string[]) {
    try {
      const params = new URLSearchParams({ preview: "delete", ids: ids.join(",") });
      const res = await fetch(`/api/admin/comments?${params.toString()}`);
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

  async function confirmDelete() {
    try {
      setDeleteDialog((prev) => ({ ...prev, submitting: true }));
      const params = new URLSearchParams({ ids: deleteDialog.ids.join(",") });
      const res = await fetch(`/api/admin/comments?${params.toString()}`, { method: "DELETE" });
      const data = await res.json();

      if (data.success) {
        setDeleteDialog(initialDeleteDialog);
        toast.success(deleteDialog.ids.length > 1 ? `已隐藏 ${deleteDialog.ids.length} 条评论` : "评论已隐藏");
        void fetchComments({ silent: true });
        return;
      }

      toast.error(getApiErrorMessage(data, "隐藏评论失败"));
    } catch {
      toast.error("隐藏评论失败，请稍后重试");
    }

    setDeleteDialog((prev) => ({ ...prev, submitting: false }));
  }

  const columns: DataColumn<CommentRow>[] = [
    { key: "content", label: "评论内容", render: (row) => <p className="line-clamp-2 max-w-xl">{row.content}</p> },
    { key: "author", label: "作者", render: (row) => row.authorLabel || row.author?.name || row.author?.email || "匿名访客" },
    {
      key: "status",
      label: "状态",
      render: (row) => (
        <div className="flex items-center gap-2">
          <StatusBadge tone={statusMeta[row.status].tone}>{statusMeta[row.status].label}</StatusBadge>
          <span className="text-xs text-[var(--muted)]">{row.status === "PENDING" ? "待你决策" : "已处理"}</span>
        </div>
      ),
    },
    {
      key: "post",
      label: "所属文章",
      render: (row) => (
        <Link className="text-[var(--primary)] hover:underline" href={`/posts/${row.post.slug}`}>
          {row.post.title}
        </Link>
      ),
    },
    { key: "date", label: "日期", render: (row) => new Date(row.createdAt).toLocaleDateString("zh-CN") },
    {
      key: "actions",
      label: "操作",
      render: (row) => (
        <div className="flex flex-wrap gap-3 text-sm">
          <button className="text-[var(--primary)] hover:underline" onClick={() => void updateStatuses([row.id], "APPROVED")} type="button">
            通过
          </button>
          <button className="text-[var(--foreground)] hover:text-[var(--primary)]" onClick={() => void updateStatuses([row.id], "REJECTED")} type="button">
            驳回
          </button>
          <button className="text-rose-600 hover:underline" onClick={() => void openDeleteDialog([row.id])} type="button">
            隐藏
          </button>
        </div>
      ),
    },
  ];

  const triageFilters: Array<{ key: "ALL" | CommentStatus; label: string }> = [
    { key: "ALL", label: "全部" },
    { key: "PENDING", label: "待审核" },
    { key: "APPROVED", label: "已通过" },
    { key: "REJECTED", label: "已驳回" },
    { key: "SPAM", label: "已隐藏" },
  ];

  const toolbarHint =
    statusFilter === "ALL" ? "当前聚焦 全部评论" : `当前聚焦 ${statusMeta[statusFilter].label} 评论`;

  const triageToolbar = (
    <Toolbar
      leading={
        <>
          <div className="min-w-0 flex-1">
            <label className="sr-only" htmlFor="admin-comments-search">
              搜索评论
            </label>
            <input
              id="admin-comments-search"
              placeholder="搜索评论内容或文章标题"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              className="ui-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {triageFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={
                  statusFilter === filter.key
                    ? "ui-btn rounded-xl bg-[var(--primary)] px-3 py-1.5 text-xs text-white"
                    : "ui-btn rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
                }
                onClick={() => {
                  setStatusFilter(filter.key);
                  setPage(1);
                }}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </>
      }
      trailing={<span className="text-sm text-[var(--muted)]">{toolbarHint}</span>}
    />
  );

  if (loading && comments.length === 0 && pagination.total === 0) return <p className="py-20 text-center text-[var(--muted)]">加载中...</p>;

  return (
    <>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Moderation"
          title="评论收件箱"
          description="围绕待审核、已通过与已驳回组织评论治理，优先完成 triage 操作。"
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatsCard
            label="全部评论"
            value={stats.total}
            icon={MessageSquare}
            scheme="blue"
            hint="点击快速过滤全部评论"
            onClick={() => {
              setStatusFilter("ALL");
              setPage(1);
            }}
            active={statusFilter === "ALL"}
          />
          <StatsCard
            label="待审核"
            value={stats.pending}
            icon={Clock}
            scheme="amber"
            hint="新评论进入待处理，优先审核"
            onClick={() => {
              setStatusFilter("PENDING");
              setPage(1);
            }}
            active={statusFilter === "PENDING"}
          />
          <StatsCard
            label="已通过"
            value={stats.approved}
            icon={CheckCircle2}
            scheme="emerald"
            hint="确认优质互动继续在线展示"
            onClick={() => {
              setStatusFilter("APPROVED");
              setPage(1);
            }}
            active={statusFilter === "APPROVED"}
          />
          <StatsCard
            label="已驳回"
            value={stats.rejected}
            icon={XCircle}
            scheme="rose"
            hint="被驳回或标记为不通过的评论"
            onClick={() => {
              setStatusFilter("REJECTED");
              setPage(1);
            }}
            active={statusFilter === "REJECTED"}
          />
        </div>

        <DataTable
          title="治理队列"
          summary="在一个视图里完成审核、驳回与隐藏操作。"
          toolbar={triageToolbar}
          columns={columns}
          rows={comments}
          emptyText="暂无评论"
          isLoading={loading}
          loadingLabel="正在加载评论队列..."
          pagination={pagination}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize);
            setPage(1);
          }}
          bulkActions={[
            { label: "批量通过", onClick: (ids) => void updateStatuses(ids, "APPROVED") },
            { label: "批量设为待审核", onClick: (ids) => void updateStatuses(ids, "PENDING") },
            { label: "批量驳回", variant: "danger", onClick: (ids) => void updateStatuses(ids, "REJECTED") },
            { label: "批量隐藏", variant: "danger", onClick: (ids) => void openDeleteDialog(ids) },
          ]}
        />
      </div>

      <DeleteImpactDialog
        confirmLabel="确认隐藏"
        description={deleteDialog.description}
        impacts={deleteDialog.impacts}
        onConfirm={confirmDelete}
        onOpenChange={(open) => setDeleteDialog((prev) => (open ? prev : initialDeleteDialog))}
        open={deleteDialog.open}
        submitting={deleteDialog.submitting}
        title={deleteDialog.title}
      />
    </>
  );
}
