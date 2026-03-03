"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { DataTable, type DataColumn } from "@/components/admin/DataTable";
import { FilterBar } from "@/components/admin/FilterBar";
import { Button, Input } from "@/components/ui";

interface TagRow {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  createdAt: string;
  _count: { posts: number };
}

const defaultColors = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899"];

function generateSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-").replace(/^-|-$/g, "");
}

export default function AdminTagsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [rows, setRows] = useState<TagRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ id: "", name: "", slug: "", color: defaultColors[0] });

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
    if (status === "authenticated" && session?.user?.role !== "ADMIN") router.push("/");
  }, [router, session, status]);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/tags");
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

  const columns: DataColumn<TagRow>[] = [
    {
      key: "name",
      label: "标签",
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: row.color || "#94a3b8" }} />
          <span>{row.name}</span>
        </div>
      ),
    },
    { key: "slug", label: "Slug", render: (row) => row.slug },
    { key: "count", label: "文章数", render: (row) => row._count.posts },
    { key: "date", label: "日期", render: (row) => new Date(row.createdAt).toLocaleDateString("zh-CN") },
    {
      key: "actions",
      label: "操作",
      render: (row) => (
        <div className="flex gap-2">
          <button className="text-[var(--brand)] hover:underline" onClick={() => setForm({ id: row.id, name: row.name, slug: row.slug, color: row.color || defaultColors[0] })} type="button">
            编辑
          </button>
          <button
            className="text-rose-600 hover:underline"
            onClick={async () => {
              if (!confirm("确定删除该标签？")) return;
              const res = await fetch(`/api/admin/tags?id=${row.id}`, { method: "DELETE" });
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
      <section className="ui-surface rounded-2xl p-5">
        <h1 className="font-display text-3xl font-extrabold text-[var(--foreground)]">标签管理</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">维护主题标签与颜色，提高内容聚合体验。</p>
      </section>
      <FilterBar placeholder="搜索标签" value={query} onChange={setQuery} />

      <form
        className="ui-surface grid grid-cols-1 gap-3 rounded-2xl p-4 md:grid-cols-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const payload = { name: form.name, slug: form.slug, color: form.color };
          const res = await fetch("/api/admin/tags", {
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
            setForm({ id: "", name: "", slug: "", color: defaultColors[0] });
          }
        }}
      >
        <Input label="名称" required value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value, slug: generateSlug(e.target.value) }))} />
        <Input label="Slug" required value={form.slug} onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))} />
        <div>
          <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">颜色</label>
          <div className="flex flex-wrap gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
            {defaultColors.map((color) => (
              <button
                key={color}
                className={`h-8 w-8 rounded-full border-2 ${form.color === color ? "border-[var(--foreground)]" : "border-transparent"}`}
                onClick={() => setForm((prev) => ({ ...prev, color }))}
                style={{ backgroundColor: color }}
                type="button"
              />
            ))}
          </div>
        </div>
        <div className="flex items-end gap-2">
          <Button type="submit">{form.id ? "保存修改" : "新增标签"}</Button>
          {form.id && (
            <Button type="button" variant="outline" onClick={() => setForm({ id: "", name: "", slug: "", color: defaultColors[0] })}>
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
              if (!confirm(`确定删除 ${ids.length} 个标签？`)) return;
              await Promise.all(ids.map((id) => fetch(`/api/admin/tags?id=${id}`, { method: "DELETE" })));
              setRows((prev) => prev.filter((item) => !ids.includes(item.id)));
            },
          },
        ]}
        columns={columns}
        emptyText="暂无标签"
        rows={filtered}
        title="标签列表"
      />
    </div>
  );
}
