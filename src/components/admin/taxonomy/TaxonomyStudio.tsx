"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { DataTable, type DataColumn } from "@/components/admin/DataTable";
import { DeleteImpactDialog } from "@/components/admin/DeleteImpactDialog";
import { EntityFormShell } from "@/components/admin/forms/EntityFormShell";
import { FilterBar } from "@/components/admin/FilterBar";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { Button } from "@/components/admin/ui";
import { useTaxonomyActions } from "@/components/admin/taxonomy/hooks/useTaxonomyActions";
import { useTaxonomyRows } from "@/components/admin/taxonomy/hooks/useTaxonomyRows";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/shadcn/ui/form";
import { Input } from "@/components/shadcn/ui/input";

type TabId = "categories" | "tags";

function resolveActiveTab(value: string | null): TabId {
  return value === "tags" ? "tags" : "categories";
}

/**
 * Generates a lightweight taxonomy slug while the user types a name.
 * This is UI convenience only; API validation still owns the final contract.
 */
function generateSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * Preserves unrelated query params while switching between category and tag tabs.
 */
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

/**
 * Shared admin workspace for categories and tags.
 * Tab routing lives here; row lifecycle and create/update actions live in dedicated hooks.
 */
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

const categoryDefaults = { id: "", name: "", slug: "", description: "" };
const tagDefaults = { id: "", name: "", slug: "", color: "#0f766e" };

const categorySchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1, "分类名称不能为空"),
  slug: z.string().trim().min(1, "Slug 不能为空"),
  description: z.string(),
});

const tagSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1, "标签名称不能为空"),
  slug: z.string().trim().min(1, "Slug 不能为空"),
  color: z.string().trim().min(1, "请选择标签颜色"),
});

type CategoryFormValues = z.infer<typeof categorySchema>;
type TagFormValues = z.infer<typeof tagSchema>;

function CategoriesManager() {
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: categoryDefaults,
  });
  const editingId = useWatch({ control: form.control, name: "id" });
  const { closeDeleteDialog, confirmDelete, deleteDialog, filtered, loading, openDeleteDialog, pagination, query, reload, setPage, setPageSize, setQuery, setRows } =
    useTaxonomyRows<CategoryRow>({
      deleteError: "隐藏分类失败",
      deleteRetryError: "隐藏分类失败，请稍后重试",
      deleteSuccess: (count) => (count > 1 ? `已隐藏 ${count} 个分类` : "分类已隐藏"),
      endpoint: "/api/admin/categories",
      filterRow: (row, keyword) => row.name.toLowerCase().includes(keyword) || row.slug.toLowerCase().includes(keyword),
      listError: "分类列表加载失败",
      listRetryError: "分类列表加载失败，请稍后重试",
      previewError: "删除影响预览加载失败",
      previewRetryError: "删除影响预览加载失败，请稍后重试",
      serverPagination: true,
    });
  const { save } = useTaxonomyActions({
    buildCreatedRow: (data) => ({ ...(data as CategoryRow), _count: { posts: 0 } }),
    buildPayload: (value: CategoryFormValues) => ({ name: value.name, slug: value.slug, description: value.description }),
    endpoint: "/api/admin/categories",
    messages: {
      createError: "创建分类失败",
      createRetryError: "创建分类失败，请稍后重试",
      createSuccess: "分类已创建",
      updateError: "保存分类失败",
      updateRetryError: "保存分类失败，请稍后重试",
      updateSuccess: "分类已保存",
    },
    onSaved: reload,
    resetForm: () => form.reset(categoryDefaults),
    setRows,
  });

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
            onClick={() => form.reset({ id: row.id, name: row.name, slug: row.slug, description: row.description ?? "" })}
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
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPage(1);
              }}
              pagination={pagination}
              rows={filtered}
              title="分类列表"
            />

            <EntityFormShell title={editingId ? "编辑分类" : "新增分类"} description="名称、Slug 和说明集中在右侧编辑，减少页面跳转。">
              <Form {...form}>
                <form className="space-y-4" onSubmit={form.handleSubmit(save)}>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>名称</FormLabel>
                        <FormControl>
                          <Input
                            aria-required="true"
                            {...field}
                            onChange={(event) => {
                              field.onChange(event);
                              form.setValue("slug", generateSlug(event.target.value), { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Slug</FormLabel>
                        <FormControl>
                          <Input aria-required="true" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>说明</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2">
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                      {editingId ? "保存修改" : "新增分类"}
                    </Button>
                    {editingId ? (
                      <Button type="button" variant="outline" onClick={() => form.reset(categoryDefaults)} disabled={form.formState.isSubmitting}>
                        取消
                      </Button>
                    ) : null}
                  </div>
                </form>
              </Form>
            </EntityFormShell>
          </div>
        )}
      </div>

      <DeleteImpactDialog
        confirmLabel="确认隐藏"
        description={deleteDialog.description}
        impacts={deleteDialog.impacts}
        onConfirm={confirmDelete}
        onOpenChange={(open) => {
          if (!open) closeDeleteDialog();
        }}
        open={deleteDialog.open}
        submitting={deleteDialog.submitting}
        title={deleteDialog.title}
      />
    </>
  );
}

const defaultColors = ["#0f766e", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a"];

function TagsManager() {
  const form = useForm<TagFormValues>({
    resolver: zodResolver(tagSchema),
    defaultValues: tagDefaults,
  });
  const editingId = useWatch({ control: form.control, name: "id" });
  const selectedColor = useWatch({ control: form.control, name: "color" });
  const { closeDeleteDialog, confirmDelete, deleteDialog, filtered, loading, openDeleteDialog, pagination, query, reload, setPage, setPageSize, setQuery, setRows } =
    useTaxonomyRows<TagRow>({
      deleteError: "隐藏标签失败",
      deleteRetryError: "隐藏标签失败，请稍后重试",
      deleteSuccess: (count) => (count > 1 ? `已隐藏 ${count} 个标签` : "标签已隐藏"),
      endpoint: "/api/admin/tags",
      filterRow: (row, keyword) => row.name.toLowerCase().includes(keyword) || row.slug.toLowerCase().includes(keyword),
      listError: "标签列表加载失败",
      listRetryError: "标签列表加载失败，请稍后重试",
      previewError: "删除影响预览加载失败",
      previewRetryError: "删除影响预览加载失败，请稍后重试",
      serverPagination: true,
    });
  const { save } = useTaxonomyActions({
    buildCreatedRow: (data) => ({ ...(data as TagRow), _count: { posts: 0 } }),
    buildPayload: (value: TagFormValues) => ({ name: value.name, slug: value.slug, color: value.color }),
    endpoint: "/api/admin/tags",
    messages: {
      createError: "创建标签失败",
      createRetryError: "创建标签失败，请稍后重试",
      createSuccess: "标签已创建",
      updateError: "保存标签失败",
      updateRetryError: "保存标签失败，请稍后重试",
      updateSuccess: "标签已保存",
    },
    onSaved: reload,
    resetForm: () => form.reset(tagDefaults),
    setRows,
  });

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
            onClick={() => form.reset({ id: row.id, name: row.name, slug: row.slug, color: row.color || defaultColors[0] })}
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
              onPageChange={setPage}
              onPageSizeChange={(nextPageSize) => {
                setPageSize(nextPageSize);
                setPage(1);
              }}
              pagination={pagination}
              rows={filtered}
              title="标签列表"
            />

            <EntityFormShell title={editingId ? "编辑标签" : "新增标签"} description="颜色与名称在右侧集中编辑，减少来回跳转。">
              <Form {...form}>
                <form className="space-y-4" onSubmit={form.handleSubmit(save)}>
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>名称</FormLabel>
                        <FormControl>
                          <Input
                            aria-required="true"
                            {...field}
                            onChange={(event) => {
                              field.onChange(event);
                              form.setValue("slug", generateSlug(event.target.value), { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Slug</FormLabel>
                        <FormControl>
                          <Input aria-required="true" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>颜色</FormLabel>
                        <FormControl>
                          <div className="flex flex-wrap gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
                            {defaultColors.map((color) => (
                              <button
                                key={color}
                                aria-label={`选择颜色 ${color}`}
                                className={`h-9 w-9 rounded-full border-2 transition ${
                                  selectedColor === color ? "scale-105 border-[var(--foreground)]" : "border-transparent"
                                }`}
                                onClick={() => field.onChange(color)}
                                style={{ backgroundColor: color }}
                                type="button"
                              />
                            ))}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2">
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                      {editingId ? "保存修改" : "新增标签"}
                    </Button>
                    {editingId ? (
                      <Button type="button" variant="outline" onClick={() => form.reset(tagDefaults)} disabled={form.formState.isSubmitting}>
                        取消
                      </Button>
                    ) : null}
                  </div>
                </form>
              </Form>
            </EntityFormShell>
          </div>
        )}
      </div>

      <DeleteImpactDialog
        confirmLabel="确认隐藏"
        description={deleteDialog.description}
        impacts={deleteDialog.impacts}
        onConfirm={confirmDelete}
        onOpenChange={(open) => {
          if (!open) closeDeleteDialog();
        }}
        open={deleteDialog.open}
        submitting={deleteDialog.submitting}
        title={deleteDialog.title}
      />
    </>
  );
}
