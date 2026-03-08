"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable, type DataColumn } from "@/components/admin/DataTable";
import { DeleteImpactDialog, type DeleteImpactItem } from "@/components/admin/DeleteImpactDialog";
import { FilterBar } from "@/components/admin/FilterBar";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { StatusBadge } from "@/components/admin/primitives/StatusBadge";

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
  SPAM: { label: "已删除", tone: "neutral" },
};

function getErrorMessage(data: unknown, fallback: string) {
  if (data && typeof data === "object") {
    const candidate = (data as { error?: string; detail?: string }).error ?? (data as { detail?: string }).detail;
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  return fallback;
}

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | CommentStatus>("ALL");
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>(initialDeleteDialog);

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/comments");
      const data = await res.json();
      if (data?.success && Array.isArray(data.data)) {
        setComments(data.data);
        return;
      }

      toast.error(getErrorMessage(data, "评论列表加载失败"));
      setComments([]);
    } catch {
      toast.error("评论列表加载失败，请稍后重试");
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, []);

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
        return;
      }

      toast.error(getErrorMessage(data, "评论状态更新失败"));
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
        toast.error(getErrorMessage(data, "删除影响预览加载失败"));
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
        void fetchComments();
        return;
      }

      toast.error(getErrorMessage(data, "隐藏评论失败"));
    } catch {
      toast.error("隐藏评论失败，请稍后重试");
    }

    setDeleteDialog((prev) => ({ ...prev, submitting: false }));
  }

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return comments.filter((item) => {
      const matchesKeyword = !keyword || item.content.toLowerCase().includes(keyword) || item.post.title.toLowerCase().includes(keyword);
      const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;
      return matchesKeyword && matchesStatus;
    });
  }, [comments, query, statusFilter]);

  const columns: DataColumn<CommentRow>[] = [
    { key: "content", label: "评论内容", render: (row) => <p className="line-clamp-2 max-w-xl">{row.content}</p> },
    { key: "author", label: "作者", render: (row) => row.authorLabel || row.author?.name || row.author?.email || "匿名访客" },
    {
      key: "status",
      label: "状态",
      render: (row) => <StatusBadge tone={statusMeta[row.status].tone}>{statusMeta[row.status].label}</StatusBadge>,
    },
    {
      key: "post",
      label: "所属文章",
      render: (row) => <Link className="text-[var(--primary)] hover:underline" href={`/posts/${row.post.slug}`}>{row.post.title}</Link>,
    },
    { key: "date", label: "日期", render: (row) => new Date(row.createdAt).toLocaleDateString("zh-CN") },
    {
      key: "actions",
      label: "操作",
      render: (row) => (
        <div className="flex items-center gap-3 text-sm">
          <button className="text-[var(--primary)] hover:underline" onClick={() => void updateStatuses([row.id], "APPROVED")} type="button">通过</button>
          <button className="text-[var(--foreground)] hover:text-[var(--primary)]" onClick={() => void updateStatuses([row.id], "REJECTED")} type="button">驳回</button>
          <button className="text-rose-600 hover:underline" onClick={() => void openDeleteDialog([row.id])} type="button">隐藏</button>
        </div>
      ),
    },
  ];

  if (loading) return <p className="py-20 text-center text-[var(--muted)]">加载中...</p>;

  return (
    <>
      <div className="space-y-4">
        <PageHeader eyebrow="Engagement" title="评论管理" description="集中处理评论审核、状态筛选和批量隐藏。" />
        <FilterBar placeholder="搜索评论内容或文章标题" value={query} onChange={setQuery}>
          {[
            { key: "ALL", label: "全部" },
            { key: "PENDING", label: "待审核" },
            { key: "APPROVED", label: "已通过" },
            { key: "REJECTED", label: "已驳回" },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              className={
                statusFilter === item.key
                  ? "ui-btn rounded-xl bg-[var(--primary)] px-3 py-2 text-sm text-white"
                  : "ui-btn rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
              }
              onClick={() => setStatusFilter(item.key as typeof statusFilter)}
            >
              {item.label}
            </button>
          ))}
        </FilterBar>
        <DataTable
          bulkActions={[
            { label: "批量通过", onClick: (ids) => void updateStatuses(ids, "APPROVED") },
            { label: "批量设为待审核", onClick: (ids) => void updateStatuses(ids, "PENDING") },
            { label: "批量驳回", variant: "danger", onClick: (ids) => void updateStatuses(ids, "REJECTED") },
            { label: "批量隐藏", variant: "danger", onClick: (ids) => void openDeleteDialog(ids) },
          ]}
          columns={columns}
          emptyText="暂无评论"
          rows={filtered}
          title="评论列表"
        />
      </div>

      <DeleteImpactDialog
        confirmLabel="确认隐藏"
        description={deleteDialog.description}
        impacts={deleteDialog.impacts}
        onConfirm={confirmDelete}
        onOpenChange={(open) => setDeleteDialog(open ? deleteDialog : initialDeleteDialog)}
        open={deleteDialog.open}
        submitting={deleteDialog.submitting}
        title={deleteDialog.title}
      />
    </>
  );
}
