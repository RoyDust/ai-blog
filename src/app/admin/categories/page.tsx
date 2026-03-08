"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable, type DataColumn } from "@/components/admin/DataTable";
import { DeleteImpactDialog, type DeleteImpactItem } from "@/components/admin/DeleteImpactDialog";
import { EntityFormShell } from "@/components/admin/forms/EntityFormShell";
import { FilterBar } from "@/components/admin/FilterBar";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { Button, Input } from "@/components/ui";

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
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

function getErrorMessage(data: unknown, fallback: string) {
  if (data && typeof data === "object") {
    const candidate = (data as { error?: string; detail?: string }).error ?? (data as { detail?: string }).detail;
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  return fallback;
}

function generateSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-").replace(/^-|-$/g, "");
}

export default function AdminCategoriesPage() {
  const [rows, setRows] = useState<CategoryRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ id: "", name: "", slug: "", description: "" });
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>(initialDeleteDialog);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/categories");
      const data = await res.json();
      if (data.success) {
        setRows(data.data);
        return;
      }

      toast.error(getErrorMessage(data, "分类列表加载失败"));
      setRows([]);
    } catch {
      toast.error("分类列表加载失败，请稍后重试");
      setRows([]);
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
    try {
      const params = new URLSearchParams({ preview: "delete", ids: ids.join(",") });
      const res = await fetch(`/api/admin/categories?${params.toString()}`);
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
      const res = await fetch(`/api/admin/categories?${params.toString()}`, { method: "DELETE" });
      const data = await res.json();

      if (data.success) {
        setRows((prev) => prev.filter((item) => !deleteDialog.ids.includes(item.id)));
        setDeleteDialog(initialDeleteDialog);
        toast.success(deleteDialog.ids.length > 1 ? `已隐藏 ${deleteDialog.ids.length} 个分类` : "分类已隐藏");
        return;
      }

      toast.error(getErrorMessage(data, "隐藏分类失败"));
    } catch {
      toast.error("隐藏分类失败，请稍后重试");
    }

    setDeleteDialog((prev) => ({ ...prev, submitting: false }));
  }

  const columns: DataColumn<CategoryRow>[] = [
    { key: "name", label: "名称", render: (row) => row.name },
    { key: "slug", label: "Slug", render: (row) => row.slug },
    { key: "description", label: "说明", render: (row) => row.description || "-" },
    { key: "count", label: "文章数", render: (row) => row._count.posts },
    { key: "date", label: "日期", render: (row) => new Date(row.createdAt).toLocaleDateString("zh-CN") },
    {
      key: "actions",
      label: "操作",
      render: (row) => (
        <div className="flex gap-3 text-sm">
          <button className="text-[var(--primary)] hover:underline" onClick={() => setForm({ id: row.id, name: row.name, slug: row.slug, description: row.description ?? "" })} type="button">编辑</button>
          <button className="text-rose-600 hover:underline" onClick={() => void openDeleteDialog([row.id])} type="button">隐藏</button>
        </div>
      ),
    },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = { name: form.name, slug: form.slug, description: form.description };
      const isEditing = Boolean(form.id);
      const res = await fetch("/api/admin/categories", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEditing ? { id: form.id, ...payload } : payload),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(getErrorMessage(data, isEditing ? "保存分类失败" : "创建分类失败"));
        return;
      }

      if (isEditing) {
        setRows((prev) => prev.map((item) => (item.id === form.id ? { ...item, ...payload } : item)));
      } else {
        setRows((prev) => [...prev, { ...data.data, _count: { posts: 0 } }]);
      }

      setForm({ id: "", name: "", slug: "", description: "" });
      toast.success(isEditing ? "分类已保存" : "分类已创建");
    } catch {
      toast.error(form.id ? "保存分类失败，请稍后重试" : "创建分类失败，请稍后重试");
    }
  }

  if (loading) return <p className="py-20 text-center text-[var(--muted)]">加载中...</p>;

  return (
    <>
      <div className="space-y-4">
        <PageHeader eyebrow="Settings" title="分类管理" description="统一维护分类结构、说明和内容归属。" />
        <FilterBar placeholder="搜索分类" value={query} onChange={setQuery} />

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
            emptyText="暂无分类"
            rows={filtered}
            title="分类列表"
          />

          <EntityFormShell title={form.id ? "编辑分类" : "新增分类"} description="名称、Slug 和说明集中在右侧编辑，减少页面跳转。">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <Input label="名称" required value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value, slug: generateSlug(e.target.value) }))} />
              <Input label="Slug" required value={form.slug} onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))} />
              <Input label="说明" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
              <div className="flex gap-2">
                <Button type="submit">{form.id ? "保存修改" : "新增分类"}</Button>
                {form.id ? <Button type="button" variant="outline" onClick={() => setForm({ id: "", name: "", slug: "", description: "" })}>取消</Button> : null}
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
