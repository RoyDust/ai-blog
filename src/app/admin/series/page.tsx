"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import useSWR from "swr";
import { z } from "zod";

import { EntityFormShell } from "@/components/admin/forms/EntityFormShell";
import { ListSearchInput, LoadingStatus, MetricStrip, MotionTableRow, SkeletonTableRows, TableStateRow } from "@/components/admin/lists";
import { adminTextActionClassName, adminTextActionDangerClassName } from "@/components/admin/primitives/admin-classes";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { AdminSectionHeader } from "@/components/admin/primitives/SectionHeader";
import { Toolbar } from "@/components/admin/primitives/Toolbar";
import { Button } from "@/components/admin/ui";
import { EmptyState } from "@/components/editorial";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/shadcn/ui/form";
import { Input } from "@/components/shadcn/ui/input";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/ui/table";
import { Textarea } from "@/components/shadcn/ui/textarea";
import { apiFetcher, apiMutate, handleGlobalSwrError, toErrorMessage } from "@/lib/client-api";

interface SeriesRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverImage: string | null;
  order: number;
  createdAt: string;
  _count: {
    posts: number;
  };
}

interface SeriesFormState {
  id: string;
  title: string;
  slug: string;
  description: string;
  coverImage: string;
  order: string;
}

const emptyForm: SeriesFormState = {
  id: "",
  title: "",
  slug: "",
  description: "",
  coverImage: "",
  order: "0",
};

const seriesFormSchema = z.object({
  id: z.string(),
  title: z.string().trim().min(1, "请输入系列标题"),
  slug: z.string().trim().min(1, "请输入 slug").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug 只能使用小写英文、数字和连字符"),
  description: z.string(),
  coverImage: z.string().trim().refine((value) => !value || URL.canParse(value), "请输入有效的封面 URL"),
  order: z.string().trim().refine((value) => /^\d+$/.test(value), "排序必须是非负整数"),
});

function toForm(row: SeriesRow): SeriesFormState {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description ?? "",
    coverImage: row.coverImage ?? "",
    order: String(row.order ?? 0),
  };
}

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AdminSeriesPage() {
  const [query, setQuery] = useState("");
  const seriesForm = useForm<SeriesFormState>({
    resolver: zodResolver(seriesFormSchema),
    defaultValues: emptyForm,
  });
  const editingSeriesId = useWatch({ control: seriesForm.control, name: "id" });

  const {
    data: seriesResponse,
    isLoading,
    mutate,
  } = useSWR<{ success?: boolean; data?: SeriesRow[] }>("/api/admin/series", apiFetcher, {
    revalidateOnMount: true,
    onError: (swrError, key) => {
      handleGlobalSwrError(swrError, key);
      toast.error(toErrorMessage(swrError, "系列列表加载失败，请稍后重试"));
    },
  });

  const series = useMemo(() => seriesResponse?.data ?? [], [seriesResponse?.data]);
  const loading = isLoading;

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return series;
    return series.filter((item) => item.title.toLowerCase().includes(keyword) || item.slug.toLowerCase().includes(keyword));
  }, [query, series]);

  async function submitSeries(values: SeriesFormState) {
    try {
      await apiMutate("/api/admin/series", {
        method: values.id ? "PATCH" : "POST",
        body: JSON.stringify({
          id: values.id || undefined,
          title: values.title,
          slug: values.slug,
          description: values.description,
          coverImage: values.coverImage,
          order: Number(values.order || 0),
        }),
      });

      toast.success(values.id ? "系列已更新" : "系列已创建");
      seriesForm.reset(emptyForm);
      void mutate();
    } catch (error) {
      toast.error(toErrorMessage(error, values.id ? "更新系列失败，请稍后重试" : "创建系列失败，请稍后重试"));
    }
  }

  async function deleteSeries(row: SeriesRow) {
    try {
      const params = new URLSearchParams({ id: row.id });
      await apiMutate(`/api/admin/series?${params.toString()}`, { method: "DELETE" });

      toast.success("系列已隐藏");
      if (seriesForm.getValues("id") === row.id) {
        seriesForm.reset(emptyForm);
      }
      void mutate();
    } catch (error) {
      toast.error(toErrorMessage(error, "隐藏系列失败，请稍后重试"));
    }
  }

  const totalPosts = series.reduce((sum, item) => sum + (item._count?.posts ?? 0), 0);

  return (
    <div>
      <PageHeader
        eyebrow="内容"
        title="文章系列"
        description="管理系列元信息。文章归入系列和文章页导航由后续集成批次接入。"
        action={
          <Button asChild variant="outline">
            <Link href="/series">前台预览</Link>
          </Button>
        }
      />

      <MetricStrip
        className="mt-1"
        items={[
          { key: "series", label: "系列", value: series.length.toLocaleString("zh-CN"), note: "当前可用系列" },
          { key: "posts", label: "收录文章", value: totalPosts.toLocaleString("zh-CN"), note: "各系列文章合计" },
          { key: "filtered", label: "匹配", value: filtered.length.toLocaleString("zh-CN"), note: query.trim() ? "按标题或 slug 过滤" : "未过滤" },
        ]}
      />

      <div className="mt-6 grid gap-x-8 gap-y-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="admin-series-list-title" className="min-w-0">
          <AdminSectionHeader
            aside={<span className="ed-mono">共 {filtered.length} 个可用系列</span>}
            description="按排序值展示，主值完整显示，slug 跟在后面"
            id="admin-series-list-title"
            title="系列列表"
          />
          <Toolbar
            leading={<ListSearchInput ariaLabel="搜索系列" onChange={setQuery} placeholder="搜索标题或 slug" value={query} />}
          />

          <div aria-busy={loading || undefined} className="overflow-x-auto">
            {loading ? <LoadingStatus label="正在加载系列..." /> : null}
            <table className="w-full min-w-[640px] table-fixed caption-bottom text-sm" data-slot="table">
              <TableHeader>
                <TableRow>
                  <TableHead>系列</TableHead>
                  <TableHead className="w-[72px] text-right">文章</TableHead>
                  <TableHead className="w-[72px] text-right">排序</TableHead>
                  <TableHead className="w-[148px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <SkeletonTableRows bars={["w-[60%]", "ml-auto w-6", "ml-auto w-6", "w-24"]} rows={4} />
                ) : filtered.length > 0 ? (
                  filtered.map((row) => (
                    <MotionTableRow key={row.id}>
                      <TableCell className="overflow-hidden">
                        <span className="flex min-w-0 items-baseline gap-2.5" title={row.description ?? undefined}>
                          <span className="shrink-0 font-serif text-[0.9375rem] font-bold text-[var(--foreground)]">{row.title}</span>
                          <span className="min-w-0 truncate font-mono text-xs text-[var(--text-muted)]">/series/{row.slug}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-[0.8125rem] text-[var(--text-body)] tabular-nums">{row._count.posts}</TableCell>
                      <TableCell className="text-right font-mono text-[0.8125rem] text-[var(--text-muted)] tabular-nums">{row.order}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-3">
                          <button type="button" className={adminTextActionClassName} onClick={() => seriesForm.reset(toForm(row))}>
                            编辑
                          </button>
                          <Link className={adminTextActionClassName} href={`/series/${row.slug}`}>
                            预览
                          </Link>
                          <button type="button" className={adminTextActionDangerClassName} onClick={() => void deleteSeries(row)}>
                            隐藏
                          </button>
                        </span>
                      </TableCell>
                    </MotionTableRow>
                  ))
                ) : (
                  <TableStateRow colSpan={4}>
                    <EmptyState description={query.trim() ? "换个关键词再试。" : "在表单里新建第一个系列。"} role="status" title="暂无系列" />
                  </TableStateRow>
                )}
              </TableBody>
            </table>
          </div>
        </section>

        <EntityFormShell
          description="slug 只能使用小写英文、数字和连字符。"
          title={editingSeriesId ? "编辑系列" : "新建系列"}
        >
          <Form {...seriesForm}>
            <form onSubmit={seriesForm.handleSubmit(submitSeries)} className="space-y-4">
              <FormField
                control={seriesForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>标题</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        onChange={(event) => {
                          field.onChange(event);
                          if (!seriesForm.getValues("slug")) {
                            seriesForm.setValue("slug", toSlug(event.target.value), { shouldValidate: true });
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={seriesForm.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Slug</FormLabel>
                    <FormControl>
                      <Input className="font-mono" {...field} onChange={(event) => field.onChange(toSlug(event.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={seriesForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>描述</FormLabel>
                    <FormControl>
                      <Textarea className="min-h-24" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={seriesForm.control}
                name="coverImage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>封面 URL</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={seriesForm.control}
                name="order"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>排序</FormLabel>
                    <FormControl>
                      <Input className="font-mono" min={0} type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-wrap gap-2">
                <Button disabled={seriesForm.formState.isSubmitting} type="submit">
                  {seriesForm.formState.isSubmitting ? "保存中..." : editingSeriesId ? "保存修改" : "创建系列"}
                </Button>
                {editingSeriesId ? (
                  <Button disabled={seriesForm.formState.isSubmitting} type="button" variant="outline" onClick={() => seriesForm.reset(emptyForm)}>
                    取消编辑
                  </Button>
                ) : null}
              </div>
            </form>
          </Form>
        </EntityFormShell>
      </div>
    </div>
  );
}
