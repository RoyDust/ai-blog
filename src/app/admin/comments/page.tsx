"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, type DataColumn } from "@/components/admin/DataTable";
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

const statusMeta: Record<CommentStatus, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  APPROVED: { label: "已通过", tone: "success" },
  PENDING: { label: "待审核", tone: "warning" },
  REJECTED: { label: "已驳回", tone: "danger" },
  SPAM: { label: "已删除", tone: "neutral" },
};

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | CommentStatus>("ALL");

  async function readJsonSafely(response: Response) {
    const contentType = response.headers?.get?.("content-type") ?? "";

    if (!contentType && typeof response.json === "function") {
      return response.json();
    }

    if (!contentType.includes("application/json")) {
      const text = await response.text();
      return text ? JSON.parse(text) : null;
    }

    return response.json();
  }

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/comments");
      const data = await readJsonSafely(res);

      if (data?.success && Array.isArray(data.data)) {
        setComments(data.data);
      }
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchComments();
  }, [fetchComments]);

  async function updateStatuses(ids: string[], status: CommentStatus) {
    const res = await fetch("/api/admin/comments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, status }),
    });
    const data = await readJsonSafely(res);

    if (data?.success) {
      setComments((prev) => prev.map((item) => (ids.includes(item.id) ? { ...item, status } : item)));
    }
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
          <button className="text-[var(--primary)] hover:underline" onClick={() => void updateStatuses([row.id], "APPROVED")} type="button">
            通过
          </button>
          <button className="text-[var(--foreground)] hover:text-[var(--primary)]" onClick={() => void updateStatuses([row.id], "REJECTED")} type="button">
            驳回
          </button>
          <button
            className="text-rose-600 hover:underline"
            onClick={async () => {
              if (!confirm("确定删除这条评论？")) return;
              const res = await fetch(`/api/admin/comments?id=${row.id}`, { method: "DELETE" });
              const data = await readJsonSafely(res);
              if (data?.success) {
                setComments((prev) => prev.filter((item) => item.id !== row.id));
              }
            }}
            type="button"
          >
            删除
          </button>
        </div>
      ),
    },
  ];

  if (loading) return <p className="py-20 text-center text-[var(--muted)]">加载中...</p>;

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Engagement" title="评论管理" description="集中治理评论，支持状态筛选、批量通过与批量隐藏。" />
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
          {
            label: "批量通过",
            onClick: (ids) => void updateStatuses(ids, "APPROVED"),
          },
          {
            label: "批量待审",
            onClick: (ids) => void updateStatuses(ids, "PENDING"),
          },
          {
            label: "批量隐藏",
            variant: "danger",
            onClick: (ids) => void updateStatuses(ids, "REJECTED"),
          },
          {
            label: "批量删除",
            variant: "danger",
            onClick: async (ids) => {
              if (!confirm(`确定删除 ${ids.length} 条评论？`)) return;
              const results = await Promise.all(ids.map((id) => fetch(`/api/admin/comments?id=${id}`, { method: "DELETE" }).then(readJsonSafely).catch(() => null)));
              if (results.every((item) => item?.success)) {
                setComments((prev) => prev.filter((item) => !ids.includes(item.id)));
              }
            },
          },
        ]}
        columns={columns}
        emptyText="暂无评论"
        rows={filtered}
        title="评论列表"
      />
    </div>
  );
}
