"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import useSWR from "swr";
import { z } from "zod";

import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { Button } from "@/components/admin/ui";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/shadcn/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/ui/table";
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Content"
        title="文章系列"
        description="管理系列元信息。文章归入系列和文章页导航由后续集成批次接入。"
        action={
          <Link href="/series">
            <Button size="sm" variant="outline">
              前台预览
            </Button>
          </Link>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Form {...seriesForm}>
          <form onSubmit={seriesForm.handleSubmit(submitSeries)} className="ui-surface space-y-4 rounded-xl p-5 shadow-[var(--shadow-card)]">
            <div>
              <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">{editingSeriesId ? "编辑系列" : "新建系列"}</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">slug 只能使用小写英文、数字和连字符。</p>
            </div>

            <FormField
              control={seriesForm.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>标题</FormLabel>
                  <FormControl>
                    <input
                      className="ui-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
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
                    <input
                      className="ui-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                      {...field}
                      onChange={(event) => field.onChange(toSlug(event.target.value))}
                    />
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
                    <textarea className="ui-ring min-h-24 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" {...field} />
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
                    <input className="ui-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" {...field} />
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
                    <input min={0} type="number" className="ui-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-wrap gap-2">
              <Button disabled={seriesForm.formState.isSubmitting} size="sm" type="submit">
                {seriesForm.formState.isSubmitting ? "保存中..." : editingSeriesId ? "保存修改" : "创建系列"}
              </Button>
              {editingSeriesId ? (
                <Button disabled={seriesForm.formState.isSubmitting} size="sm" type="button" variant="outline" onClick={() => seriesForm.reset(emptyForm)}>
                  取消编辑
                </Button>
              ) : null}
            </div>
          </form>
        </Form>

        <section className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
            <div>
              <h2 className="text-base font-semibold text-[var(--foreground)]">系列列表</h2>
              <p className="mt-1 text-xs text-[var(--text-muted)]">共 {filtered.length} 个可用系列</p>
            </div>
            <input
              aria-label="搜索系列"
              className="ui-ring min-w-[220px] rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              placeholder="搜索标题或 slug"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="overflow-x-auto">
            <Table className="min-w-[720px] table-fixed">
              <TableHeader className="border-b border-[var(--border)] bg-[var(--surface-alt)] shadow-[0_1px_0_rgba(15,23,42,0.06)]">
                <TableRow className="border-0 hover:bg-transparent">
                  <TableHead className="w-[52%] px-4 py-3.5 text-xs uppercase tracking-wide text-[var(--text-muted)]">系列</TableHead>
                  <TableHead className="w-[90px] px-4 py-3.5 text-xs uppercase tracking-wide text-[var(--text-muted)]">文章</TableHead>
                  <TableHead className="w-[90px] px-4 py-3.5 text-xs uppercase tracking-wide text-[var(--text-muted)]">排序</TableHead>
                  <TableHead className="px-4 py-3.5 text-xs uppercase tracking-wide text-[var(--text-muted)]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-[var(--text-muted)]">
                      正在加载系列...
                    </TableCell>
                  </TableRow>
                ) : filtered.length > 0 ? (
                  filtered.map((row) => (
                    <TableRow key={row.id} className="border-[var(--border)] transition-colors hover:bg-[var(--surface-alt)]/80">
                      <TableCell className="whitespace-normal px-4 py-4 align-top">
                        <div className="space-y-1">
                          <div className="font-medium text-[var(--foreground)]">{row.title}</div>
                          <div className="font-mono text-xs text-[var(--text-muted)]">/series/{row.slug}</div>
                          {row.description ? <p className="line-clamp-2 text-xs leading-5 text-[var(--text-muted)]">{row.description}</p> : null}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-4 align-top text-[var(--text-muted)]">{row._count.posts}</TableCell>
                      <TableCell className="px-4 py-4 align-top text-[var(--text-muted)]">{row.order}</TableCell>
                      <TableCell className="whitespace-normal px-4 py-4 align-top">
                        <div className="flex flex-wrap items-center gap-3">
                          <button type="button" className="text-[var(--brand)] hover:underline" onClick={() => seriesForm.reset(toForm(row))}>
                            编辑
                          </button>
                          <Link className="text-[var(--foreground)] hover:text-[var(--brand)]" href={`/series/${row.slug}`}>
                            预览
                          </Link>
                          <button type="button" className="text-rose-600 hover:underline" onClick={() => void deleteSeries(row)}>
                            隐藏
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-[var(--text-muted)]">
                      暂无系列
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </section>
    </div>
  );
}
