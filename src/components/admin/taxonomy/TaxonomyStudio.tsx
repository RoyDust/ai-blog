"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { DataTable, type DataColumn } from "@/components/admin/DataTable";
import { DeleteImpactDialog, type DeleteImpactItem } from "@/components/admin/DeleteImpactDialog";
import { EntityFormShell } from "@/components/admin/forms/EntityFormShell";
import { FilterBar } from "@/components/admin/FilterBar";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { Button, Input } from "@/components/ui";

type TabId = "categories" | "tags";

function resolveActiveTab(value: string | null): TabId {
  return value === "tags" ? "tags" : "categories";
}

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

function buildNextHref(pathname: string, current: URLSearchParams, tab: TabId) {
  const params = new URLSearchParams(current.toString());
  params.set("tab", tab);
  return `${pathname}?${params.toString()}`;
}

function TabButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active ? "bg-[var(--foreground)] text-[var(--background)]" : "text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
      }`}
      type="button"
      aria-pressed={active}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

export function TaxonomyStudio() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = resolveActiveTab(searchParams.get("tab"));

  const goToTab = useCallback(
    (tab: TabId) => {
      router.replace(buildNextHref(pathname, new URLSearchParams(searchParams.toString()), tab));
    },
    [pathname, router, searchParams],
  );

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Structure" title="分类与标签" description="统一维护分类结构与标签归类。" />

      <div className="ui-surface flex flex-wrap items-center gap-2 rounded-full p-2">
        <TabButton active={activeTab === "categories"} label="分类" onClick={() => goToTab("categories")} />
        <TabButton active={activeTab === "tags"} label="标签" onClick={() => goToTab("tags")} />
      </div>

      {activeTab === "categories" ? <CategoriesManager /> : <TagsManager />}
    </div>
  );
}

export default TaxonomyStudio;

interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  _count: { posts: number };
}

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

function CategoriesManager() {
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
          <button
            className="text-[var(--primary)] hover:underline"
            onClick={() => setForm({ id: row.id, name: row.name, slug: row.slug, description: row.description ?? "" })}
            type="button"
          >
            编辑
          </button>
          <button className="text-rose-600 hover:underline" onClick={() => void openDeleteDialog([row.id])} type="button">
            隐藏
          </button>
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

  return (
    <>
      <div className="space-y-4">
        <FilterBar placeholder="搜索分类" value={query} onChange={setQuery} />

        {loading ? (
          <p className="py-16 text-center text-[var(--muted)]">加载中...</p>
        ) : (
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
                <Input
                  label="名称"
                  required
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value, slug: generateSlug(e.target.value) }))}
                />
                <Input label="Slug" required value={form.slug} onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))} />
                <Input label="说明" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} />
                <div className="flex gap-2">
                  <Button type="submit">{form.id ? "保存修改" : "新增分类"}</Button>
                  {form.id ? (
                    <Button type="button" variant="outline" onClick={() => setForm({ id: "", name: "", slug: "", description: "" })}>
                      取消
                    </Button>
                  ) : null}
                </div>
              </form>
            </EntityFormShell>
          </div>
        )}
      </div>

      <DeleteImpactDialog
        confirmLabel="确认隐藏"
        description={deleteDialog.description}
        impacts={deleteDialog.impacts}
        onConfirm={confirmDelete}
        onOpenChange={(open) => setDeleteDialog((prev) => (open ? prev : initialDeleteDialog))}
        open={deleteDialog.open}
        submitting={deleteDialog.submitting}
        title={deleteDialog.title}
      />
    </>
  );
}

const defaultColors = ["#0f766e", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a"];

function TagsManager() {
  const [rows, setRows] = useState<TagRow[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ id: "", name: "", slug: "", color: defaultColors[0] });
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>(initialDeleteDialog);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/tags");
      const data = await res.json();
      if (data.success) {
        setRows(data.data);
        return;
      }

      toast.error(getErrorMessage(data, "标签列表加载失败"));
      setRows([]);
    } catch {
      toast.error("标签列表加载失败，请稍后重试");
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
      const res = await fetch(`/api/admin/tags?${params.toString()}`);
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
      const res = await fetch(`/api/admin/tags?${params.toString()}`, { method: "DELETE" });
      const data = await res.json();

      if (data.success) {
        setRows((prev) => prev.filter((item) => !deleteDialog.ids.includes(item.id)));
        setDeleteDialog(initialDeleteDialog);
        toast.success(deleteDialog.ids.length > 1 ? `已隐藏 ${deleteDialog.ids.length} 个标签` : "标签已隐藏");
        return;
      }

      toast.error(getErrorMessage(data, "隐藏标签失败"));
    } catch {
      toast.error("隐藏标签失败，请稍后重试");
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
          <button
            className="text-[var(--primary)] hover:underline"
            onClick={() => setForm({ id: row.id, name: row.name, slug: row.slug, color: row.color || defaultColors[0] })}
            type="button"
          >
            编辑
          </button>
          <button className="text-rose-600 hover:underline" onClick={() => void openDeleteDialog([row.id])} type="button">
            隐藏
          </button>
        </div>
      ),
    },
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const payload = { name: form.name, slug: form.slug, color: form.color };
      const isEditing = Boolean(form.id);
      const res = await fetch("/api/admin/tags", {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEditing ? { id: form.id, ...payload } : payload),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(getErrorMessage(data, isEditing ? "保存标签失败" : "创建标签失败"));
        return;
      }

      if (isEditing) {
        setRows((prev) => prev.map((item) => (item.id === form.id ? { ...item, ...payload } : item)));
      } else {
        setRows((prev) => [...prev, { ...data.data, _count: { posts: 0 } }]);
      }

      setForm({ id: "", name: "", slug: "", color: defaultColors[0] });
      toast.success(isEditing ? "标签已保存" : "标签已创建");
    } catch {
      toast.error(form.id ? "保存标签失败，请稍后重试" : "创建标签失败，请稍后重试");
    }
  }

  return (
    <>
      <div className="space-y-4">
        <FilterBar placeholder="搜索标签" value={query} onChange={setQuery} />

        {loading ? (
          <p className="py-16 text-center text-[var(--muted)]">加载中...</p>
        ) : (
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

            <EntityFormShell title={form.id ? "编辑标签" : "新增标签"} description="颜色与名称在右侧集中编辑，减少来回跳转。">
              <form className="space-y-4" onSubmit={handleSubmit}>
                <Input
                  label="名称"
                  required
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value, slug: generateSlug(e.target.value) }))}
                />
                <Input label="Slug" required value={form.slug} onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value }))} />
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--foreground)]">颜色</label>
                  <div className="flex flex-wrap gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
                    {defaultColors.map((color) => (
                      <button
                        key={color}
                        className={`h-9 w-9 rounded-full border-2 transition ${
                          form.color === color ? "border-[var(--foreground)] scale-105" : "border-transparent"
                        }`}
                        onClick={() => setForm((prev) => ({ ...prev, color }))}
                        style={{ backgroundColor: color }}
                        type="button"
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit">{form.id ? "保存修改" : "新增标签"}</Button>
                  {form.id ? (
                    <Button type="button" variant="outline" onClick={() => setForm({ id: "", name: "", slug: "", color: defaultColors[0] })}>
                      取消
                    </Button>
                  ) : null}
                </div>
              </form>
            </EntityFormShell>
          </div>
        )}
      </div>

      <DeleteImpactDialog
        confirmLabel="确认隐藏"
        description={deleteDialog.description}
        impacts={deleteDialog.impacts}
        onConfirm={confirmDelete}
        onOpenChange={(open) => setDeleteDialog((prev) => (open ? prev : initialDeleteDialog))}
        open={deleteDialog.open}
        submitting={deleteDialog.submitting}
        title={deleteDialog.title}
      />
    </>
  );
}
