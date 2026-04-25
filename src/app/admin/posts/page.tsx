"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable, type DataColumn } from "@/components/admin/DataTable";
import { DeleteImpactDialog, type DeleteImpactItem } from "@/components/admin/DeleteImpactDialog";
import { Toolbar } from "@/components/admin/primitives/Toolbar";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { Button } from "@/components/ui";
import {
  getSummaryStatusForExcerpt,
  isActiveSummaryStatus,
  type PostSummaryStatus,
} from "@/lib/post-summary-status";

interface PostRow {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  summaryStatus?: PostSummaryStatus | null;
  summaryError?: string | null;
  summaryGeneratedAt?: string | null;
  summaryJobId?: string | null;
  summaryModelId?: string | null;
  published: boolean;
  viewCount: number;
  createdAt: string;
  author: { name: string | null; email: string };
  _count: { comments: number; likes: number };
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

function getSummaryStatus(post: PostRow): PostSummaryStatus {
  if (post.summaryStatus) {
    return post.summaryStatus;
  }

  return getSummaryStatusForExcerpt(post.excerpt);
}

export default function AdminPostsPage() {
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [busyRowIds, setBusyRowIds] = useState<string[]>([]);
  const [startingSummary, setStartingSummary] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>(initialDeleteDialog);

  const fetchPosts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/posts");
      const data = await res.json();
      if (data.success) {
        setPosts(data.data);
        return;
      }

      toast.error(getErrorMessage(data, "文章列表加载失败"));
      setPosts([]);
    } catch {
      toast.error("文章列表加载失败，请稍后重试");
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPosts();
  }, [fetchPosts]);

  const activeSummaryIds = useMemo(
    () => posts.filter((post) => isActiveSummaryStatus(getSummaryStatus(post))).map((post) => post.id),
    [posts],
  );

  const syncSummaryJobs = useCallback(async () => {
    try {
      await fetch("/api/admin/posts/summarize/bulk?resume=1");
      await fetchPosts();
    } catch {
      toast.error("摘要任务状态同步失败");
    }
  }, [fetchPosts]);

  useEffect(() => {
    if (activeSummaryIds.length === 0) {
      return;
    }

    let cancelled = false;
    const sync = async () => {
      try {
        await fetch("/api/admin/posts/summarize/bulk?resume=1");
        if (!cancelled) {
          await fetchPosts();
        }
      } catch {
        if (!cancelled) {
          toast.error("摘要任务状态同步失败");
        }
      }
    };
    const timer = window.setInterval(() => {
      void sync();
    }, 2500);

    void sync();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeSummaryIds.length, fetchPosts]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return posts.filter((post) => {
      const matchesKeyword = !keyword || post.title.toLowerCase().includes(keyword) || post.slug.toLowerCase().includes(keyword);
      const matchesStatus = statusFilter === "all" || (statusFilter === "published" ? post.published : !post.published);
      return matchesKeyword && matchesStatus;
    });
  }, [posts, query, statusFilter]);

  async function openDeleteDialog(ids: string[]) {
    try {
      const params = new URLSearchParams({ preview: "delete", ids: ids.join(",") });
      const res = await fetch(`/api/admin/posts?${params.toString()}`);
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
      const res = await fetch(`/api/admin/posts?${params.toString()}`, { method: "DELETE" });
      const data = await res.json();

      if (data.success) {
        setPosts((prev) => prev.filter((post) => !deleteDialog.ids.includes(post.id)));
        setDeleteDialog(initialDeleteDialog);
        toast.success(deleteDialog.ids.length > 1 ? `已隐藏 ${deleteDialog.ids.length} 篇文章` : "文章已隐藏");
        return;
      }

      toast.error(getErrorMessage(data, "隐藏文章失败"));
    } catch {
      toast.error("隐藏文章失败，请稍后重试");
    }

    setDeleteDialog((prev) => ({ ...prev, submitting: false }));
  }

  async function summarizeSelected(ids: string[]) {
    if (ids.length === 0 || startingSummary) {
      return;
    }

    setStartingSummary(true);

    try {
      const res = await fetch("/api/admin/posts/summarize/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(getErrorMessage(data, "批量摘要生成失败"));
      }

      const queued = Number(data.data?.queued ?? 0);
      const failed = Number(data.data?.failed ?? 0);
      const jobId = typeof data.data?.jobId === "string" ? data.data.jobId : null;
      const results = Array.isArray(data.data?.results) ? data.data.results : [];

      setPosts((prev) =>
        prev.map((post) => {
          const result = results.find((item: { id?: unknown }) => item.id === post.id);

          if (result?.status === "queued") {
            return {
              ...post,
              summaryStatus: "QUEUED",
              summaryError: null,
              summaryJobId: jobId,
            };
          }

          if (result?.status === "failed") {
            return {
              ...post,
              summaryStatus: "FAILED",
              summaryError: typeof result.error === "string" ? result.error : "摘要生成失败",
              summaryJobId: jobId,
            };
          }

          return post;
        }),
      );

      if (queued > 0) {
        toast.success(failed > 0 ? `已加入 ${queued} 篇摘要队列，${failed} 篇失败` : `已加入 ${queued} 篇摘要队列`);
        void syncSummaryJobs();
        return;
      }

      toast.error(failed > 0 ? `${failed} 篇摘要生成失败` : "没有文章被更新");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "批量摘要生成失败");
    } finally {
      setStartingSummary(false);
    }
  }

  async function togglePublish(row: PostRow) {
    if (busyRowIds.includes(row.id)) {
      return;
    }

    const nextPublished = !row.published;
    setBusyRowIds((prev) => [...prev, row.id]);
    setPosts((prev) => prev.map((item) => (item.id === row.id ? { ...item, published: nextPublished } : item)));

    try {
      const res = await fetch("/api/admin/posts/publish", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, published: nextPublished }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "更新发布状态失败");
      }

      toast.success(nextPublished ? "文章已发布" : "已转为草稿");
    } catch (error) {
      setPosts((prev) => prev.map((item) => (item.id === row.id ? { ...item, published: row.published } : item)));
      toast.error(error instanceof Error ? error.message : "更新发布状态失败");
    } finally {
      setBusyRowIds((prev) => prev.filter((id) => id !== row.id));
    }
  }

  const columns: DataColumn<PostRow>[] = [
    {
      key: "title",
      label: "标题",
      render: (row) => (
        <div className="space-y-1">
          <Link className="font-medium text-[var(--foreground)] hover:text-[var(--brand)]" href={`/admin/posts/${row.id}/edit`}>
            {row.title}
          </Link>
          <p className="text-xs text-[var(--muted)]">/posts/{row.slug}</p>
        </div>
      ),
    },
    { key: "author", label: "作者", render: (row) => row.author.name || row.author.email },
    {
      key: "excerpt",
      label: "摘要",
      render: (row) => {
        const summaryStatus = getSummaryStatus(row);

        if (summaryStatus === "QUEUED") {
          return <StatusBadge tone="warning">排队中</StatusBadge>;
        }

        if (summaryStatus === "GENERATING") {
          return <StatusBadge tone="warning">生成中</StatusBadge>;
        }

        if (summaryStatus === "FAILED") {
          return (
            <div className="max-w-[260px] space-y-1">
              <StatusBadge tone="danger">生成失败</StatusBadge>
              {row.summaryError ? <p className="line-clamp-2 text-xs leading-5 text-rose-600">{row.summaryError}</p> : null}
              {row.excerpt?.trim() ? <p className="line-clamp-2 text-xs leading-5 text-[var(--muted)]">{row.excerpt}</p> : null}
            </div>
          );
        }

        if (!row.excerpt?.trim()) {
          return <StatusBadge>未生成</StatusBadge>;
        }

        return (
          <div className="max-w-[260px] space-y-1">
            <StatusBadge tone="success">{summaryStatus === "GENERATED" ? "已生成" : "已填写"}</StatusBadge>
            <p className="line-clamp-2 text-xs leading-5 text-[var(--muted)]">{row.excerpt}</p>
          </div>
        );
      },
    },
    {
      key: "status",
      label: "状态",
      render: (row) => (
        <div className="space-y-2">
          <StatusBadge tone={row.published ? "success" : "warning"}>{row.published ? "已发布" : "草稿"}</StatusBadge>
          <Button
            size="sm"
            type="button"
            variant={row.published ? "outline" : "secondary"}
            disabled={busyRowIds.includes(row.id)}
            onClick={() => void togglePublish(row)}
          >
            {row.published ? "切换为草稿" : "切换为已发布"}
          </Button>
        </div>
      ),
    },
    {
      key: "stats",
      label: "上下文",
      render: (row) => (
        <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
          <span>阅读 {row.viewCount}</span>
          <span>评论 {row._count.comments}</span>
          <span>点赞 {row._count.likes}</span>
        </div>
      ),
    },
    { key: "createdAt", label: "创建时间", render: (row) => new Date(row.createdAt).toLocaleDateString("zh-CN") },
    {
      key: "actions",
      label: "操作",
      render: (row) => (
        <div className="flex items-center gap-3 text-sm">
          <Link className="text-[var(--brand)] hover:underline" href={`/admin/posts/${row.id}/edit`}>
            编辑
          </Link>
          <Link className="text-[var(--foreground)] hover:text-[var(--brand)]" href={`/posts/${row.slug}`}>
            预览
          </Link>
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
        <PageHeader
          eyebrow="Content"
          title="内容队列"
          description="围绕草稿、发布和复盘组织文章操作。"
          action={
            <Link href="/admin/posts/new">
              <Button size="sm">新建文章</Button>
            </Link>
          }
        />

        <Toolbar
          leading={
            <>
              <input
                aria-label="搜索文章"
                className="ui-ring min-w-[240px] flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
                placeholder="搜索标题或 slug"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              {[
                { key: "all", label: "全部内容" },
                { key: "draft", label: "仅看草稿" },
                { key: "published", label: "已发布" },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={statusFilter === item.key}
                  className={
                    statusFilter === item.key
                      ? "ui-btn rounded-xl bg-[var(--primary)] px-3 py-2 text-sm text-white"
                      : "ui-btn rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
                  }
                  onClick={() => setStatusFilter(item.key as typeof statusFilter)}
                >
                  {item.label}
                </button>
              ))}
            </>
          }
          trailing={<span className="text-sm text-[var(--muted)]">共 {filtered.length} 篇内容</span>}
        />

        <DataTable
          title="文章列表"
          summary="按内容状态和发布时间组织内容队列。"
          densityLabel="内容队列"
          toolbar={
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
              <span>支持批量 AI 摘要、隐藏与状态切换</span>
              {activeSummaryIds.length > 0 ? <StatusBadge tone="warning">{activeSummaryIds.length} 篇摘要处理中</StatusBadge> : null}
            </div>
          }
          isLoading={loading}
          loadingLabel="正在加载内容队列..."
          bulkActions={[
            {
              label: startingSummary ? "加入队列中" : "AI 生成摘要",
              disabled: startingSummary,
              onClick: (ids) => void summarizeSelected(ids),
            },
            {
              label: "批量隐藏",
              variant: "danger",
              onClick: (ids) => void openDeleteDialog(ids),
            },
          ]}
          columns={columns}
          emptyText="暂无文章"
          rows={filtered}
        />
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
