"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { DataTable, type DataColumn } from "@/components/admin/DataTable";
import { FilterBar } from "@/components/admin/FilterBar";
import { Button, Input } from "@/components/ui";

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  _count: { posts: number };
}

function generateSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-").replace(/^-|-$/g, "");
}

export default function AdminCategoriesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ id: "", name: "", slug: "", description: "" });

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && session?.user?.role !== "ADMIN") router.push("/");
  }, [router, session, status]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/categories");
        const data = await res.json();
        if (data.success) setRows(data.data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(keyword) || row.slug.toLowerCase().includes(keyword));
  }, [query, rows]);

  const columns: DataColumn<CategoryRow>[] = [
    { key: "name", label: "名称", render: (row) => row.name },
    { key: "slug", label: "Slug", render: (row) => row.slug },
    { key: "count", label: "文章数", render: (row) => row._count.posts },
    { key: "date", label: "日期", render: (row) => new Date(row.createdAt).toLocaleDateString("zh-CN") },
    {
      key: "actions",
      label: "操作",
      render: (row) => (
        <div className="flex gap-2">
          <button
            className="text-[var(--brand)] hover:underline"
            onClick={() => setForm({ id: row.id, name: row.name, slug: row.slug, description: row.description ?? "" })}
            type="button"
          >
            编辑
          </button>
          <button
            className="text-rose-600 hover:underline"
            onClick={async () => {
              if (!confirm("确定删除该分类？")) return;
              const res = await fetch(`/api/admin/categories?id=${row.id}`, { method: "DELETE" });
              const data = await res.json();
              if (data.success) {
                setRows((prev) => prev.filter((item) => item.id !== row.id));
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
      <h1 className="font-display text-3xl font-extrabold text-[var(--foreground)]">分类管理</h1>
      <FilterBar placeholder="搜索分类" value={query} onChange={setQuery} />

      <form
        className="ui-surface grid grid-cols-1 gap-3 rounded-2xl p-4 md:grid-cols-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const payload = { name: form.name, slug: form.slug, description: form.description };
          const res = await fetch("/api/admin/categories", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          if (data.success) {
            if (form.id) {
              setRows((prev) => prev.map((item) => (item.id === form.id ? { ...item, ...payload } : item)));
            } else {
              setRows((prev) => [...prev, { ...data.data, _count: { posts: 0 } }]);
            }
            setForm({ id: "", name: "", slug: "", description: "" });
          }
        }}
      >
        <Input label="名称" required value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value, slug: generateSlug(e.target.value) }))} />
        <Input label="Slug" required value={form.slug} onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))} />
        <Input label="描述" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
        <div className="flex items-end gap-2">
          <Button type="submit">{form.id ? "保存修改" : "新增分类"}</Button>
          {form.id && (
            <Button type="button" variant="outline" onClick={() => setForm({ id: "", name: "", slug: "", description: "" })}>
              取消
            </Button>
          )}
        </div>
      </form>

      <DataTable
        bulkActions={[
          {
            label: "批量删除",
            variant: "danger",
            onClick: async (ids) => {
              if (!confirm(`确定删除 ${ids.length} 个分类？`)) return;
              await Promise.all(ids.map((id) => fetch(`/api/admin/categories?id=${id}`, { method: "DELETE" })));
              setRows((prev) => prev.filter((item) => !ids.includes(item.id)));
            },
          },
        ]}
        columns={columns}
        emptyText="暂无分类"
        rows={filtered}
        title="分类列表"
      />
    </div>
  );
}
