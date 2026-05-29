import Link from "next/link";

import { AdminPagination } from "@/components/admin/primitives/AdminPagination";
import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { Button } from "@/components/admin/ui";

type Task = {
  id: string;
  type: string;
  status: string;
  source: string;
  modelId: string | null;
  requestedCount: number;
  succeededCount: number;
  failedCount: number;
  startedAt: Date | string | null;
  finishedAt: Date | string | null;
  createdAt: Date | string;
  lastError: string | null;
  items?: Array<{ post?: { title: string } | null }>;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type AiTaskListSearchParams = {
  status?: string | null;
  type?: string | null;
  limit?: string | null;
};

const taskTypeLabels: Record<string, string> = {
  "post-summary": "文章摘要",
  "post-article-info": "文章信息",
  "post-seo-description": "SEO 描述",
  "post-title-suggestion": "标题建议",
  "post-slug-suggestion": "Slug 建议",
  "post-tag-suggestion": "标签建议",
  "post-category-suggestion": "分类建议",
  "post-cover-image": "封面生图",
  "post-bulk-completion": "批量补全",
};

const statusLabels: Record<string, string> = {
  QUEUED: "排队中",
  RUNNING: "执行中",
  SUCCEEDED: "已完成",
  PARTIAL_FAILED: "部分失败",
  FAILED: "失败",
};

/**
 * 将任务状态映射到后台统一的状态徽标色调。
 */
function statusTone(status: string) {
  if (status === "SUCCEEDED") return "success";
  if (status === "FAILED" || status === "PARTIAL_FAILED") return "danger";
  if (status === "RUNNING" || status === "QUEUED") return "warning";
  return "neutral";
}

/**
 * AI 任务列表使用的紧凑时间格式。
 */
function formatDate(value: Date | string | null) {
  if (!value) return "-";

  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * 根据开始/结束时间计算任务耗时；未结束任务按当前时间持续滚动。
 */
function formatDuration(task: Task) {
  if (!task.startedAt) return "-";
  const end = task.finishedAt ? new Date(task.finishedAt).getTime() : Date.now();
  const duration = Math.max(0, Math.round((end - new Date(task.startedAt).getTime()) / 1000));

  if (duration < 60) return `${duration}s`;
  return `${Math.floor(duration / 60)}m ${duration % 60}s`;
}

/**
 * AI 任务记录表。
 *
 * 这里只展示聚合进度和最近错误，单项输出与重试入口在任务详情页处理。
 */
export function AiTaskList({
  tasks,
  pagination,
  searchParams,
}: {
  tasks: Task[];
  pagination: Pagination;
  searchParams?: AiTaskListSearchParams;
}) {
  return (
    <section className="ui-surface overflow-hidden rounded-3xl shadow-[var(--shadow-card)]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-[var(--foreground)]">任务记录</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">共 {pagination.total} 个 AI 任务，按最近创建排序。</p>
        </div>
        <span className="rounded-full bg-[var(--surface-alt)] px-3 py-1 text-xs font-medium text-[var(--muted)]">
          第 {pagination.page} / {pagination.totalPages} 页
        </span>
      </header>

      {tasks.length === 0 ? (
        <p className="px-4 py-12 text-center text-sm text-[var(--muted)]">暂无 AI 任务记录</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-[var(--surface-alt)]">
              <tr>
                {["任务", "状态", "进度", "耗时", "创建时间", "最近错误", "操作"].map((label) => (
                  <th key={label} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {tasks.map((task) => (
                <tr key={task.id} className="transition-colors hover:bg-[var(--surface-alt)]/60">
                  <td className="px-4 py-3 align-top">
                    <div className="space-y-1">
                      <p className="font-medium text-[var(--foreground)]">{taskTypeLabels[task.type] ?? task.type}</p>
                      <p className="text-xs text-[var(--muted)]">{task.source} · {task.modelId ?? "默认模型"}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <StatusBadge tone={statusTone(task.status)}>{statusLabels[task.status] ?? task.status}</StatusBadge>
                  </td>
                  <td className="px-4 py-3 align-top text-sm text-[var(--foreground)]">
                    {task.succeededCount}/{task.requestedCount} 成功
                    {task.failedCount > 0 ? <span className="ml-2 text-rose-600">{task.failedCount} 失败</span> : null}
                  </td>
                  <td className="px-4 py-3 align-top text-sm text-[var(--muted)]">{formatDuration(task)}</td>
                  <td className="px-4 py-3 align-top text-sm text-[var(--muted)]">{formatDate(task.createdAt)}</td>
                  <td className="max-w-[260px] px-4 py-3 align-top text-sm text-[var(--muted)]">
                    <span className="line-clamp-2">{task.lastError ?? "-"}</span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <Link href={`/admin/ai/tasks/${task.id}`}>
                      <Button size="sm" variant="outline" type="button">查看</Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination.total > 0 ? (
        <AdminPagination
          hrefBase="/admin/ai/tasks"
          hrefParams={{
            status: searchParams?.status,
            type: searchParams?.type,
            limit: String(pagination.limit),
          }}
          itemLabel="个 AI 任务"
          page={pagination.page}
          pageSize={pagination.limit}
          pageSizeOptions={[10, 20, 50]}
          total={pagination.total}
          totalPages={pagination.totalPages}
        />
      ) : null}
    </section>
  );
}
