import Link from "next/link";

import { AiTaskActivitySync } from "@/components/admin/ai/AiTaskActivitySync";
import { AiTaskList } from "@/components/admin/ai/AiTaskList";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { StatusBadge } from "@/components/admin/primitives/StatusBadge";
import { Button } from "@/components/ui";
import { listAiTasks } from "@/lib/ai-tasks";

export const dynamic = "force-dynamic";

const filters = [
  { label: "全部", status: null },
  { label: "处理中", status: "RUNNING" },
  { label: "排队中", status: "QUEUED" },
  { label: "失败", status: "FAILED" },
  { label: "部分失败", status: "PARTIAL_FAILED" },
  { label: "已完成", status: "SUCCEEDED" },
];

export default async function AdminAiTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; type?: string }>;
}) {
  const params = await searchParams;
  const data = await listAiTasks({ page: params.page, status: params.status, type: params.type });
  const activeTaskCount = data.tasks.filter((task) => task.status === "QUEUED" || task.status === "RUNNING").length;

  return (
    <div className="space-y-6">
      <AiTaskActivitySync activeTaskCount={activeTaskCount} />
      <PageHeader
        eyebrow="AI"
        title="AI 任务记录"
        description="集中查看摘要、SEO、标签和批量补全的运行历史，失败项可从详情页重试。"
        action={
          <Link href="/admin/ai/models">
            <Button size="sm" variant="outline" type="button">模型管理</Button>
          </Link>
        }
      />

      <section className="ui-surface rounded-3xl px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          {filters.map((filter) => {
            const active = (params.status ?? null) === filter.status;
            const href = filter.status ? `/admin/ai/tasks?status=${filter.status}` : "/admin/ai/tasks";

            return (
              <Link
                key={filter.label}
                href={href}
                className={
                  active
                    ? "ui-btn rounded-xl bg-[var(--primary)] px-3 py-2 text-sm text-white"
                    : "ui-btn rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--surface-alt)]"
                }
              >
                {filter.label}
              </Link>
            );
          })}
          {activeTaskCount > 0 ? <StatusBadge tone="warning">{activeTaskCount} 个任务处理中</StatusBadge> : null}
        </div>
      </section>

      <AiTaskList tasks={data.tasks} pagination={data.pagination} />
    </div>
  );
}
