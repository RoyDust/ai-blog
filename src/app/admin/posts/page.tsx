"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { DataTable, type DataColumn } from "@/components/admin/DataTable";
import { FilterBar } from "@/components/admin/FilterBar";

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
  const { data: session, status } = useSession();
  const router = useRouter();
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && session?.user?.role !== "ADMIN") router.push("/");
  }, [router, session, status]);

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
    fetchPosts();
  }, []);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return posts;
    return posts.filter((post) => post.title.toLowerCase().includes(keyword) || post.slug.toLowerCase().includes(keyword));
  }, [posts, query]);

  const columns: DataColumn<PostRow>[] = [
    {
      key: "title",
      label: "标题",
      render: (row) => (
        <Link className="font-medium text-[var(--brand)] hover:underline" href={`/posts/${row.slug}`}>
          {row.title}
        </Link>
      ),
    },
    {
      key: "author",
      label: "作者",
      render: (row) => row.author.name || row.author.email,
    },
    {
      key: "status",
      label: "状态",
      render: (row) => (
        <button
          className={row.published ? "ui-btn bg-emerald-600 px-3 py-1 text-xs text-white" : "ui-btn bg-amber-500 px-3 py-1 text-xs text-white"}
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
          {row.published ? "已发布" : "草稿"}
        </button>
      ),
    },
    {
      key: "stats",
      label: "统计",
      render: (row) => `阅读 ${row.viewCount} / 评论 ${row._count.comments} / 点赞 ${row._count.likes}`,
    },
    {
      key: "createdAt",
      label: "日期",
      render: (row) => new Date(row.createdAt).toLocaleDateString("zh-CN"),
    },
    {
      key: "actions",
      label: "操作",
      render: (row) => (
        <div className="flex items-center gap-2">
          <Link className="text-sm text-[var(--brand)] hover:underline" href={`/admin/posts/${row.id}/edit`}>
            编辑
          </Link>
          <button
            className="text-sm text-rose-600 hover:underline"
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

  if (status === "loading" || loading) return <p className="py-20 text-center text-[var(--muted)]">加载中...</p>;

  return (
    <div className="space-y-4">
      <section className="ui-surface rounded-2xl p-5">
        <h1 className="font-display text-3xl font-extrabold text-[var(--foreground)]">文章管理</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">以高信息密度查看状态并快速进入 Markdown 编辑。</p>
      </section>
      <FilterBar placeholder="搜索标题或 slug" value={query} onChange={setQuery}>
        <Link className="ui-btn bg-[var(--brand)] px-3 py-2 text-sm text-white hover:bg-[var(--brand-strong)]" href="/write">
          新建文章
        </Link>
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
