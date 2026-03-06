"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DataTable, type DataColumn } from "@/components/admin/DataTable";
import { FilterBar } from "@/components/admin/FilterBar";
import { PageHeader } from "@/components/admin/primitives/PageHeader";

interface CommentRow {
  id: string;
  content: string;
  createdAt: string;
  author: { name: string | null; email: string };
  post: { title: string; slug: string };
}

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    async function fetchComments() {
      try {
        const res = await fetch("/api/admin/comments");
        const data = await res.json();
        if (data.success) setComments(data.data);
      } finally {
        setLoading(false);
      }
    }

    void fetchComments();
  }, []);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return comments;
    return comments.filter((item) => item.content.toLowerCase().includes(keyword) || item.post.title.toLowerCase().includes(keyword));
  }, [comments, query]);

  const columns: DataColumn<CommentRow>[] = [
    { key: "content", label: "评论内容", render: (row) => <p className="line-clamp-2 max-w-xl">{row.content}</p> },
    { key: "author", label: "作者", render: (row) => row.author.name || row.author.email },
    {
      key: "post",
      label: "所属文章",
      render: (row) => <Link className="text-[var(--brand)] hover:underline" href={`/posts/${row.post.slug}`}>{row.post.title}</Link>,
    },
    { key: "date", label: "日期", render: (row) => new Date(row.createdAt).toLocaleDateString("zh-CN") },
    {
      key: "actions",
      label: "操作",
      render: (row) => (
        <button
          className="text-rose-600 hover:underline"
          onClick={async () => {
            if (!confirm("确定删除这条评论？")) return;
            const res = await fetch(`/api/admin/comments?id=${row.id}`, { method: "DELETE" });
            const data = await res.json();
            if (data.success) {
              setComments((prev) => prev.filter((item) => item.id !== row.id));
            }
          }}
          type="button"
        >
          删除
        </button>
      ),
    },
  ];

  if (loading) return <p className="py-20 text-center text-[var(--muted)]">加载中...</p>;

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Engagement" title="评论管理" description="集中审核用户互动内容，支持搜索与批量治理。" />
      <FilterBar placeholder="搜索评论内容或文章标题" value={query} onChange={setQuery} />
      <DataTable
        bulkActions={[
          {
            label: "批量删除",
            variant: "danger",
            onClick: async (ids) => {
              if (!confirm(`确定删除 ${ids.length} 条评论？`)) return;
              await Promise.all(ids.map((id) => fetch(`/api/admin/comments?id=${id}`, { method: "DELETE" })));
              setComments((prev) => prev.filter((item) => !ids.includes(item.id)));
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
