"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DataTable, type DataColumn } from "@/components/admin/DataTable";
import { FilterBar } from "@/components/admin/FilterBar";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { Button } from "@/components/ui";

interface PostRow {
  id: string;
  title: string;
  slug: string;
  published: boolean;
  viewCount: number;
  createdAt: string;
  author: { name: string | null; email: string };
  _count: { comments: number; likes: number };
}

export default function AdminPostsPage() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");

  useEffect(() => {
    async function fetchPosts() {
      try {
        const res = await fetch("/api/admin/posts");
        const data = await res.json();
        if (data.success) setPosts(data.data);
      } finally {
        setLoading(false);
      }
    }

    void fetchPosts();
  }, []);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return posts.filter((post) => {
      const matchesKeyword = !keyword || post.title.toLowerCase().includes(keyword) || post.slug.toLowerCase().includes(keyword);
      const matchesStatus = statusFilter === "all" || (statusFilter === "published" ? post.published : !post.published);
      return matchesKeyword && matchesStatus;
    });
  }, [posts, query, statusFilter]);

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
      key: "status",
      label: "状态",
      render: (row) => (
        <button
          className="rounded-full"
          onClick={async () => {
            const next = !row.published;
            const res = await fetch("/api/admin/posts/publish", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: row.id, published: next }),
            });
            const data = await res.json();
            if (data.success) {
              setPosts((prev) => prev.map((post) => (post.id === row.id ? { ...post, published: next } : post)));
            }
          }}
          type="button"
        >
          <StatusBadge tone={row.published ? "success" : "warning"}>{row.published ? "已发布" : "草稿"}</StatusBadge>
        </button>
      ),
    },
    {
      key: "stats",
      label: "统计",
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
          <Link className="text-[var(--brand)] hover:underline" href={`/admin/posts/${row.id}/edit`}>编辑</Link>
          <Link className="text-[var(--foreground)] hover:text-[var(--brand)]" href={`/posts/${row.slug}`}>预览</Link>
          <button
            className="text-rose-600 hover:underline"
            onClick={async () => {
              if (!confirm("确定删除这篇文章？该操作不可撤销。")) return;
              const res = await fetch(`/api/admin/posts?id=${row.id}`, { method: "DELETE" });
              const data = await res.json();
              if (data.success) {
                setPosts((prev) => prev.filter((post) => post.id !== row.id));
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
      <PageHeader
        eyebrow="Content"
        title="文章管理"
        description="在统一工作台中搜索、筛选、发布与进入编辑工作区。"
        action={<Link href="/admin/posts/new"><Button size="sm">新建文章</Button></Link>}
      />

      <FilterBar placeholder="搜索标题或 slug" value={query} onChange={setQuery}>
        {[
          { key: "all", label: "全部" },
          { key: "published", label: "已发布" },
          { key: "draft", label: "草稿" },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            className={
              statusFilter === item.key
                ? "ui-btn rounded-xl bg-[var(--brand)] px-3 py-2 text-sm text-white"
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
            label: "批量删除",
            variant: "danger",
            onClick: async (ids) => {
              if (!confirm(`确定删除 ${ids.length} 篇文章？`)) return;
              await Promise.all(ids.map((id) => fetch(`/api/admin/posts?id=${id}`, { method: "DELETE" })));
              setPosts((prev) => prev.filter((post) => !ids.includes(post.id)));
            },
          },
        ]}
        columns={columns}
        emptyText="暂无文章"
        rows={filtered}
        title="文章列表"
      />
    </div>
  );
}

