import Link from "next/link";
import type { ReactNode } from "react";

import { MotionTableRow } from "@/components/admin/lists";
import { AdminPagination } from "@/components/admin/primitives/AdminPagination";
import { adminTextActionClassName } from "@/components/admin/primitives/admin-classes";
import { AdminSectionHeader } from "@/components/admin/primitives/SectionHeader";
import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { EmptyState } from "@/components/editorial";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/ui/table";

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
  if (status === "RUNNING") return "info";
  if (status === "QUEUED") return "warning";
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
  toolbar,
}: {
  tasks: Task[];
  pagination: Pagination;
  searchParams?: AiTaskListSearchParams;
  /** 区块标题之下、表格之上的工具栏（状态筛选） */
  toolbar?: ReactNode;
}) {
  return (
    <section aria-labelledby="admin-ai-tasks-title">
      <AdminSectionHeader
        aside={
          <span className="ed-mono">
            第 {pagination.page} / {Math.max(pagination.totalPages, 1)} 页<span className="ed-meta-sep">·</span>
            {pagination.total} 个任务
          </span>
        }
        description={`共 ${pagination.total} 个 AI 任务，按最近创建排序。`}
        id="admin-ai-tasks-title"
        title="任务记录"
      />
      {toolbar ? <div className="pt-3 pb-3.5">{toolbar}</div> : <div className="pt-3" />}

      {tasks.length === 0 ? (
        <div className="border-t border-[var(--reader-border-strong)]">
          <EmptyState description="去文章列表选择内容并运行 AI 任务后，记录会出现在这里。" role="status" title="暂无 AI 任务记录" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] table-fixed caption-bottom text-sm" data-slot="table">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[26%]">任务</TableHead>
                <TableHead className="w-[84px]">状态</TableHead>
                <TableHead className="w-[136px]">进度</TableHead>
                <TableHead className="w-[80px] text-right">耗时</TableHead>
                <TableHead className="w-[120px]">创建时间</TableHead>
                <TableHead>最近错误</TableHead>
                <TableHead className="w-[64px]">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <MotionTableRow key={task.id}>
                  <TableCell className="overflow-hidden">
                    <span className="flex min-w-0 items-baseline gap-2">
                      {/* 每行只保留一个指向详情的链接（操作列「查看」），避免同 href 重复 */}
                      <span className="shrink-0 font-serif text-[0.9375rem] font-bold text-[var(--foreground)]">{taskTypeLabels[task.type] ?? task.type}</span>
                      <span className="min-w-0 truncate text-xs text-[var(--text-muted)]">
                        {task.source} · {task.modelId ?? "默认模型"}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={statusTone(task.status)}>{statusLabels[task.status] ?? task.status}</StatusBadge>
                  </TableCell>
                  <TableCell className="font-mono text-[0.8125rem] text-[var(--foreground)] tabular-nums">
                    {task.succeededCount}/{task.requestedCount} 成功
                    {task.failedCount > 0 ? <span className="ml-2 font-bold text-[var(--danger-foreground)]">{task.failedCount} 失败</span> : null}
                  </TableCell>
                  <TableCell className="text-right font-mono text-[0.8125rem] text-[var(--text-muted)] tabular-nums">{formatDuration(task)}</TableCell>
                  <TableCell className="font-mono text-[0.8125rem] text-[var(--text-muted)] tabular-nums">{formatDate(task.createdAt)}</TableCell>
                  <TableCell
                    className={`truncate text-[0.8125rem] ${task.lastError ? "text-[var(--danger-foreground)]" : "text-[var(--text-muted)]"}`}
                    title={task.lastError ?? undefined}
                  >
                    {task.lastError ?? "-"}
                  </TableCell>
                  <TableCell>
                    <Link className={adminTextActionClassName} href={`/admin/ai/tasks/${task.id}`}>
                      查看
                    </Link>
                  </TableCell>
                </MotionTableRow>
              ))}
            </TableBody>
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
