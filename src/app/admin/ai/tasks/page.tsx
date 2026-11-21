import Link from "next/link";

import { AiTaskActivitySync } from "@/components/admin/ai/AiTaskActivitySync";
import { AiTaskList } from "@/components/admin/ai/AiTaskList";
import { MetricStrip } from "@/components/admin/lists";
import { adminTabClassName } from "@/components/admin/primitives/admin-classes";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { Button } from "@/components/admin/ui";
import { ActiveUnderline } from "@/components/editorial";
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

type AiTaskPageSearchParams = {
  page?: string;
  status?: string;
  type?: string;
  limit?: string;
};

function buildTasksHref(
  params: AiTaskPageSearchParams,
  updates: { page?: string; status?: string | null },
) {
  const query = new URLSearchParams();
  const nextStatus = updates.status !== undefined ? updates.status : params.status;
  const nextPage = updates.page !== undefined ? updates.page : params.page;

  if (nextStatus) query.set("status", nextStatus);
  if (params.type) query.set("type", params.type);
  if (params.limit) query.set("limit", params.limit);
  if (nextPage && nextPage !== "1") query.set("page", nextPage);

  const queryString = query.toString();
  return queryString ? `/admin/ai/tasks?${queryString}` : "/admin/ai/tasks";
}

export default async function AdminAiTasksPage({
  searchParams,
}: {
  searchParams: Promise<AiTaskPageSearchParams>;
}) {
  const params = await searchParams;
  const data = await listAiTasks({ page: params.page, limit: params.limit, status: params.status, type: params.type });
  const activeTaskCount = data.tasks.filter((task) => task.status === "QUEUED" || task.status === "RUNNING").length;

  const failedOnPage = data.tasks.filter((task) => task.status === "FAILED" || task.status === "PARTIAL_FAILED").length;
  const succeededOnPage = data.tasks.filter((task) => task.status === "SUCCEEDED").length;

  const statusTabs = (
    <nav aria-label="按状态筛选" className="flex flex-wrap items-center gap-1">
      {filters.map((filter) => {
        const active = (params.status ?? null) === filter.status;
        const href = buildTasksHref(params, { status: filter.status, page: "1" });

        return (
          <Link key={filter.label} aria-current={active ? "page" : undefined} className={adminTabClassName} href={href}>
            {filter.label}
            {active ? <ActiveUnderline layoutId="admin-ai-task-status" /> : null}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div>
      <AiTaskActivitySync activeTaskCount={activeTaskCount} observedTaskIds={data.tasks.map((task) => task.id)} />
      <PageHeader
        eyebrow="AI 助手"
        title="AI 任务记录"
        description="集中查看摘要、SEO、标签和批量补全的运行历史，失败项可从详情页重试。"
        meta={
          activeTaskCount > 0 ? (
            <span className="font-bold text-[var(--warning)]" role="status">
              {activeTaskCount} 个任务处理中
            </span>
          ) : undefined
        }
        action={
          <Button asChild variant="outline">
            <Link href="/admin/ai/models">模型管理</Link>
          </Button>
        }
      />

      <MetricStrip
        ariaLabel="AI 任务概况"
        className="mt-1"
        items={[
          { key: "total", label: "任务总数", value: data.pagination.total.toLocaleString("zh-CN"), note: "当前筛选下" },
          { key: "active", label: "本页处理中", value: activeTaskCount.toLocaleString("zh-CN"), note: "排队或执行中，自动刷新", tone: activeTaskCount > 0 ? "warning" : "default" },
          { key: "failed", label: "本页失败", value: failedOnPage.toLocaleString("zh-CN"), note: "含部分失败，可在详情重试", tone: failedOnPage > 0 ? "danger" : "default" },
          { key: "succeeded", label: "本页已完成", value: succeededOnPage.toLocaleString("zh-CN"), note: "全部条目成功", tone: succeededOnPage > 0 ? "success" : "default" },
        ]}
      />

      <div className="mt-6">
        <AiTaskList
          pagination={data.pagination}
          searchParams={{ status: params.status, type: params.type, limit: params.limit }}
          tasks={data.tasks}
          toolbar={statusTabs}
        />
      </div>
    </div>
  );
}
