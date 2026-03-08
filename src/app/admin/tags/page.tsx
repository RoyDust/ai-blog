"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DataTable, type DataColumn } from "@/components/admin/DataTable";
import { DeleteImpactDialog, type DeleteImpactItem } from "@/components/admin/DeleteImpactDialog";
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

const defaultColors = ["#0f766e", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a"];

function generateSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-").replace(/^-|-$/g, "");
}

export default function AdminTagsPage() {
  const [rows, setRows] = useState<TagRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ id: "", name: "", slug: "", color: defaultColors[0] });
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>(initialDeleteDialog);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/tags");
      const data = await res.json();
      if (data.success) setRows(data.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) => row.name.toLowerCase().includes(keyword) || row.slug.toLowerCase().includes(keyword));
  }, [query, rows]);

  async function openDeleteDialog(ids: string[]) {
    const params = new URLSearchParams({ preview: "delete", ids: ids.join(",") });
    const res = await fetch(`/api/admin/tags?${params.toString()}`);
    const data = await res.json();
    if (!data.success) return;

    setDeleteDialog({
      open: true,
      ids,
      title: data.data.title,
      description: data.data.description,
      impacts: data.data.impacts,
      submitting: false,
    });
  }

  async function confirmDelete() {
    setDeleteDialog((prev) => ({ ...prev, submitting: true }));
    const params = new URLSearchParams({ ids: deleteDialog.ids.join(",") });
    const res = await fetch(`/api/admin/tags?${params.toString()}`, { method: "DELETE" });
    const data = await res.json();

    if (data.success) {
      setRows((prev) => prev.filter((item) => !deleteDialog.ids.includes(item.id)));
      setDeleteDialog(initialDeleteDialog);
      return;
    }

    setDeleteDialog((prev) => ({ ...prev, submitting: false }));
  }

  const columns: DataColumn<TagRow>[] = [
    {
      key: "name",
      label: "名称",
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
          <button className="text-rose-600 hover:underline" onClick={() => void openDeleteDialog([row.id])} type="button">删除</button>
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
    <>
      <div className="space-y-4">
        <PageHeader eyebrow="Settings" title="标签管理" description="统一管理标签命名、颜色和聚合配置。" />
        <FilterBar placeholder="搜索标签" value={query} onChange={setQuery} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <DataTable
            bulkActions={[
              {
                label: "批量隐藏",
                variant: "danger",
                onClick: (ids) => void openDeleteDialog(ids),
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