import { notFound } from "next/navigation";

import { AiTaskActivitySync } from "@/components/admin/ai/AiTaskActivitySync";
import { AiTaskDetail } from "@/components/admin/ai/AiTaskDetail";
import { PageHeader } from "@/components/admin/primitives/PageHeader";
import { TextLink } from "@/components/editorial";
import { NotFoundError } from "@/lib/api-errors";
import { getAiTaskDetail } from "@/lib/ai-tasks";

export const dynamic = "force-dynamic";

function serializeTask(task: Awaited<ReturnType<typeof getAiTaskDetail>>) {
  return {
    ...task,
    startedAt: task.startedAt?.toISOString() ?? null,
    finishedAt: task.finishedAt?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    items: task.items.map((item) => ({
      ...item,
      startedAt: item.startedAt?.toISOString() ?? null,
      finishedAt: item.finishedAt?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  };
}

export default async function AdminAiTaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let task: Awaited<ReturnType<typeof getAiTaskDetail>>;

  try {
    task = await getAiTaskDetail(id);
  } catch (error) {
    if (error instanceof NotFoundError) {
      notFound();
    }

    throw error;
  }

  const activeTaskCount = task.status === "QUEUED" || task.status === "RUNNING" ? 1 : 0;

  return (
    <div className="flex flex-col gap-7 pb-2">
      <AiTaskActivitySync activeTaskCount={activeTaskCount} observedTaskIds={[task.id]} />
      <PageHeader
        eyebrow={
          <TextLink arrow="left" href="/admin/ai/tasks">
            返回任务列表
          </TextLink>
        }
        title="AI 任务详情"
        description="查看每个文章项的生成结果、失败原因，并对可应用建议进行人工确认。"
        meta={<span className="font-mono">#{task.id.slice(-8)}</span>}
      />

      <AiTaskDetail task={serializeTask(task)} />
    </div>
  );
}
