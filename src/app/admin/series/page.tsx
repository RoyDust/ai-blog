"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { Button } from "@/components/admin/ui";
import { getApiErrorMessage } from "@/lib/admin-api-client";

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
  const [series, setSeries] = useState<SeriesRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<SeriesFormState>(emptyForm);
  const [query, setQuery] = useState("");

  async function fetchSeries() {
    try {
      const response = await fetch("/api/admin/series");
      const payload = await response.json();

      if (!payload.success) {
        toast.error(getApiErrorMessage(payload, "系列列表加载失败"));
        setSeries([]);
        return;
      }

      setSeries(payload.data);
    } catch {
      toast.error("系列列表加载失败，请稍后重试");
      setSeries([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchSeries();
  }, []);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return series;
    return series.filter((item) => item.title.toLowerCase().includes(keyword) || item.slug.toLowerCase().includes(keyword));
  }, [query, series]);

  async function submitSeries(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch("/api/admin/series", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id || undefined,
          title: form.title,
          slug: form.slug,
          description: form.description,
          coverImage: form.coverImage,
          order: Number(form.order || 0),
        }),
      });
      const payload = await response.json();

      if (!payload.success) {
        toast.error(getApiErrorMessage(payload, form.id ? "更新系列失败" : "创建系列失败"));
        return;
      }

      toast.success(form.id ? "系列已更新" : "系列已创建");
      setForm(emptyForm);
      await fetchSeries();
    } catch {
      toast.error(form.id ? "更新系列失败，请稍后重试" : "创建系列失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteSeries(row: SeriesRow) {
    try {
      const params = new URLSearchParams({ id: row.id });
      const response = await fetch(`/api/admin/series?${params.toString()}`, { method: "DELETE" });
      const payload = await response.json();

      if (!payload.success) {
        toast.error(getApiErrorMessage(payload, "隐藏系列失败"));
        return;
      }

      toast.success("系列已隐藏");
      if (form.id === row.id) {
        setForm(emptyForm);
      }
      setSeries((prev) => prev.filter((item) => item.id !== row.id));
    } catch {
      toast.error("隐藏系列失败，请稍后重试");
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
        <form onSubmit={submitSeries} className="ui-surface space-y-4 rounded-xl p-5 shadow-[var(--shadow-card)]">
          <div>
            <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">{form.id ? "编辑系列" : "新建系列"}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">slug 只能使用小写英文、数字和连字符。</p>
          </div>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">标题</span>
            <input
              required
              className="ui-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              value={form.title}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  title: event.target.value,
                  slug: prev.slug ? prev.slug : toSlug(event.target.value),
                }))
              }
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">Slug</span>
            <input
              required
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              className="ui-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              value={form.slug}
              onChange={(event) => setForm((prev) => ({ ...prev, slug: toSlug(event.target.value) }))}
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">描述</span>
            <textarea
              className="ui-ring min-h-24 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">封面 URL</span>
            <input
              className="ui-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              value={form.coverImage}
              onChange={(event) => setForm((prev) => ({ ...prev, coverImage: event.target.value }))}
            />
          </label>

          <label className="block space-y-1 text-sm">
            <span className="font-medium text-[var(--foreground)]">排序</span>
            <input
              min={0}
              type="number"
              className="ui-ring w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              value={form.order}
              onChange={(event) => setForm((prev) => ({ ...prev, order: event.target.value }))}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <Button disabled={submitting} size="sm" type="submit">
              {form.id ? "保存修改" : "创建系列"}
            </Button>
            {form.id ? (
              <Button disabled={submitting} size="sm" type="button" variant="outline" onClick={() => setForm(emptyForm)}>
                取消编辑
              </Button>
            ) : null}
          </div>
        </form>

        <section className="ui-surface rounded-xl p-5 shadow-[var(--shadow-card)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">系列列表</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">共 {filtered.length} 个可用系列</p>
            </div>
            <input
              aria-label="搜索系列"
              className="ui-ring min-w-[220px] rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              placeholder="搜索标题或 slug"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--border)] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-[var(--muted)]">
                  <th className="py-3 pr-4 font-medium">系列</th>
                  <th className="py-3 pr-4 font-medium">文章</th>
                  <th className="py-3 pr-4 font-medium">排序</th>
                  <th className="py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[var(--muted)]">
                      正在加载系列...
                    </td>
                  </tr>
                ) : filtered.length > 0 ? (
                  filtered.map((row) => (
                    <tr key={row.id}>
                      <td className="max-w-md py-4 pr-4">
                        <div className="space-y-1">
                          <div className="font-medium text-[var(--foreground)]">{row.title}</div>
                          <div className="text-xs text-[var(--muted)]">/series/{row.slug}</div>
                          {row.description ? <p className="line-clamp-2 text-xs leading-5 text-[var(--muted)]">{row.description}</p> : null}
                        </div>
                      </td>
                      <td className="py-4 pr-4 text-[var(--muted)]">{row._count.posts}</td>
                      <td className="py-4 pr-4 text-[var(--muted)]">{row.order}</td>
                      <td className="py-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <button type="button" className="text-[var(--brand)] hover:underline" onClick={() => setForm(toForm(row))}>
                            编辑
                          </button>
                          <Link className="text-[var(--foreground)] hover:text-[var(--brand)]" href={`/series/${row.slug}`}>
                            预览
                          </Link>
                          <button type="button" className="text-rose-600 hover:underline" onClick={() => void deleteSeries(row)}>
                            隐藏
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-[var(--muted)]">
                      暂无系列
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </div>
  );
}
