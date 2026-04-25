"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { Button } from "@/components/ui";

type TaskItem = {
  id: string;
  postId: string | null;
  action: string;
  status: string;
  output: unknown;
  applied: boolean;
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  updatedAt: string;
  post: {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    seoDescription: string | null;
  } | null;
};

type TaskDetail = {
  id: string;
  type: string;
  status: string;
  source: string;
  modelId: string | null;
  requestedCount: number;
  succeededCount: number;
  failedCount: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  lastError: string | null;
  metadata: unknown;
  items: TaskItem[];
  createdBy?: { name: string | null; email: string } | null;
};

const taskTypeLabels: Record<string, string> = {
  "post-summary": "文章摘要",
  "post-seo-description": "SEO 描述",
  "post-title-suggestion": "标题建议",
  "post-slug-suggestion": "Slug 建议",
  "post-tag-suggestion": "标签建议",
  "post-category-suggestion": "分类建议",
  "post-bulk-completion": "批量补全",
};

const actionLabels: Record<string, string> = {
  summary: "摘要",
  "seo-description": "SEO 描述",
  title: "标题",
  slug: "Slug",
  tags: "标签",
  category: "分类",
};

const statusLabels: Record<string, string> = {
  QUEUED: "排队中",
  RUNNING: "执行中",
  SUCCEEDED: "已完成",
  PARTIAL_FAILED: "部分失败",
  FAILED: "失败",
  SKIPPED: "已跳过",
};

function statusTone(status: string) {
  if (status === "SUCCEEDED") return "success";
  if (status === "FAILED" || status === "PARTIAL_FAILED") return "danger";
  if (status === "RUNNING" || status === "QUEUED") return "warning";
  return "neutral";
}

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(task: TaskDetail) {
  if (!task.startedAt) return "-";
  const end = task.finishedAt ? new Date(task.finishedAt).getTime() : Date.now();
  const duration = Math.max(0, Math.round((end - new Date(task.startedAt).getTime()) / 1000));

  if (duration < 60) return `${duration}s`;
  return `${Math.floor(duration / 60)}m ${duration % 60}s`;
}

function readOutput(output: unknown) {
  return output && typeof output === "object" && !Array.isArray(output) ? (output as Record<string, unknown>) : {};
}

function toStringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function renderOutput(item: TaskItem) {
  const output = readOutput(item.output);

  if (item.action === "summary" && typeof output.summary === "string") {
    return output.summary;
  }

  if (item.action === "seo-description" && typeof output.seoDescription === "string") {
    return output.seoDescription;
  }

  if (item.action === "title") {
    return toStringList(output.titles).join(" / ") || "-";
  }

  if (item.action === "slug" && typeof output.slug === "string") {
    return output.slug;
  }

  if (item.action === "tags") {
    return toStringList(output.names).join("、") || toStringList(output.newTagNames).join("、") || "-";
  }

  if (item.action === "category") {
    return [output.categoryName, output.reason].filter((value): value is string => typeof value === "string" && value.length > 0).join("：") || "-";
  }

  if (Object.keys(output).length === 0) {
    return "-";
  }

  return JSON.stringify(output);
}

function canApply(item: TaskItem) {
  return item.status === "SUCCEEDED" && Boolean(item.postId) && !item.applied;
}

export function AiTaskDetail({ task }: { task: TaskDetail }) {
  const router = useRouter();
  const [items, setItems] = useState(task.items);
  const [retrying, setRetrying] = useState(false);
  const [applyingItemId, setApplyingItemId] = useState<string | null>(null);
  const failedCount = useMemo(() => items.filter((item) => item.status === "FAILED").length, [items]);

  async function retryFailedItems() {
    if (retrying || failedCount === 0) {
      return;
    }

    setRetrying(true);
    try {
      const response = await fetch(`/api/admin/ai/tasks/${task.id}/retry`, { method: "POST" });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "重试任务失败");
      }

      toast.success("已创建失败项重试任务");
      router.push(`/admin/ai/tasks/${data.data.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "重试任务失败");
    } finally {
      setRetrying(false);
    }
  }

  async function applyItem(itemId: string) {
    setApplyingItemId(itemId);
    try {
      const response = await fetch("/api/admin/ai/actions/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "应用建议失败");
      }

      setItems((current) => current.map((item) => (item.id === itemId ? { ...item, applied: true } : item)));
      toast.success("AI 建议已应用");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "应用建议失败");
    } finally {
      setApplyingItemId(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="ui-surface rounded-3xl p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-[var(--muted)]">AI Task</p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-[var(--foreground)]">
              {taskTypeLabels[task.type] ?? task.type}
            </h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {task.source} · {task.modelId ?? "默认模型"} · {task.createdBy?.name ?? task.createdBy?.email ?? "系统"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={statusTone(task.status)}>{statusLabels[task.status] ?? task.status}</StatusBadge>
            <Button type="button" size="sm" variant="outline" disabled={failedCount === 0 || retrying} onClick={() => void retryFailedItems()}>
              {retrying ? "重试中..." : "重试失败项"}
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["请求项", task.requestedCount],
            ["成功", task.succeededCount],
            ["失败", task.failedCount],
            ["耗时", formatDuration(task)],
            ["创建时间", formatDate(task.createdAt)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-3">
              <p className="text-xs text-[var(--muted)]">{label}</p>
              <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{value}</p>
            </div>
          ))}
        </div>

        {task.lastError ? <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{task.lastError}</p> : null}
      </section>

      <section className="ui-surface overflow-hidden rounded-3xl shadow-[var(--shadow-card)]">
        <header className="border-b border-[var(--border)] px-4 py-3">
          <h3 className="font-display text-lg font-semibold text-[var(--foreground)]">任务项</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">逐条查看输出、失败原因和应用状态。</p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead className="bg-[var(--surface-alt)]">
              <tr>
                {["文章", "动作", "状态", "输出预览", "错误", "应用", "更新时间"].map((label) => (
                  <th key={label} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {items.map((item) => (
                <tr key={item.id} className="transition-colors hover:bg-[var(--surface-alt)]/60">
                  <td className="px-4 py-3 align-top">
                    {item.post ? (
                      <Link className="font-medium text-[var(--foreground)] hover:text-[var(--brand)]" href={`/admin/posts/${item.post.id}/edit`}>
                        {item.post.title}
                      </Link>
                    ) : (
                      <span className="text-sm text-[var(--muted)]">文章不存在</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-sm text-[var(--foreground)]">{actionLabels[item.action] ?? item.action}</td>
                  <td className="px-4 py-3 align-top">
                    <StatusBadge tone={statusTone(item.status)}>{statusLabels[item.status] ?? item.status}</StatusBadge>
                  </td>
                  <td className="max-w-[320px] px-4 py-3 align-top text-sm leading-6 text-[var(--muted)]">
                    <span className="line-clamp-3">{renderOutput(item)}</span>
                  </td>
                  <td className="max-w-[260px] px-4 py-3 align-top text-sm text-rose-600">
                    <span className="line-clamp-3">{item.error ?? "-"}</span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    {item.applied ? (
                      <StatusBadge tone="success">已应用</StatusBadge>
                    ) : canApply(item) ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={applyingItemId === item.id}
                        onClick={() => void applyItem(item.id)}
                      >
                        {applyingItemId === item.id ? "应用中..." : "应用"}
                      </Button>
                    ) : (
                      <span className="text-sm text-[var(--muted)]">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-sm text-[var(--muted)]">{formatDate(item.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
