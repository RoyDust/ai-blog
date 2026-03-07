"use client";

import { useEffect, useMemo, useState } from "react";
import { DataTable, type DataColumn } from "@/components/admin/DataTable";
import { EntityFormShell } from "@/components/admin/forms/EntityFormShell";
import { FilterBar } from "@/components/admin/FilterBar";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
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
  const [rows, setRows] = useState<TagRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ id: "", name: "", slug: "", color: defaultColors[0] });

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

    void load();
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
        <div className="flex gap-3 text-sm">
          <button className="text-[var(--primary)] hover:underline" onClick={() => setForm({ id: row.id, name: row.name, slug: row.slug, color: row.color || defaultColors[0] })} type="button">编辑</button>
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = { name: form.name, slug: form.slug, color: form.color };
    const res = await fetch("/api/admin/tags", {
      method: form.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form.id ? { id: form.id, ...payload } : payload),
    });
    const data = await res.json();
    if (!data.success) return;

    if (form.id) {
      setRows((prev) => prev.map((item) => (item.id === form.id ? { ...item, ...payload } : item)));
    } else {
      setRows((prev) => [...prev, { ...data.data, _count: { posts: 0 } }]);
    }

    setForm({ id: "", name: "", slug: "", color: defaultColors[0] });
  }

  if (loading) return <p className="py-20 text-center text-[var(--muted)]">加载中...</p>;

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Settings" title="标签管理" description="统一管理标签命名、颜色和聚合配置。" />
      <FilterBar placeholder="搜索标签" value={query} onChange={setQuery} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
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

        <EntityFormShell title={form.id ? "编辑标签" : "新增标签"} description="颜色与名称在右侧集中编辑，减少配置页来回跳转。">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input label="名称" required value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value, slug: generateSlug(e.target.value) }))} />
            <Input label="Slug" required value={form.slug} onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))} />
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">颜色</label>
              <div className="flex flex-wrap gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
                {defaultColors.map((color) => (
                  <button
                    key={color}
                    className={`h-9 w-9 rounded-full border-2 transition ${form.color === color ? "border-[var(--foreground)] scale-105" : "border-transparent"}`}
                    onClick={() => setForm((prev) => ({ ...prev, color }))}
                    style={{ backgroundColor: color }}
                    type="button"
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit">{form.id ? "保存修改" : "新增标签"}</Button>
              {form.id ? <Button type="button" variant="outline" onClick={() => setForm({ id: "", name: "", slug: "", color: defaultColors[0] })}>取消</Button> : null}
            </div>
          </form>
        </EntityFormShell>
      </div>
    </div>
  );
}
