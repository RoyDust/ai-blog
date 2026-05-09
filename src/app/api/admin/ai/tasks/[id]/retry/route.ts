import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { retryAiTaskFailedItems } from "@/lib/ai-tasks";
import { resumeAiBatchTasks, runAiBatchTask } from "@/lib/ai-batch-jobs";
import { resumePostSummaryJobs } from "@/lib/post-summary-jobs";
import { toErrorResponse } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";

/**
 * 为指定 AI 任务的失败项创建重试任务。
 *
 * 旧摘要任务、批量补全任务和单项 AI 动作的恢复路径不同，
 * 这里按任务类型分发到对应的执行器。
 */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdminSession();
    const { id } = await params;
    const retryTask = await retryAiTaskFailedItems(id, session.user.id);

    if (retryTask.type === "post-summary") {
      const postIds = retryTask.items.map((item) => item.postId).filter((postId): postId is string => Boolean(postId));
      if (postIds.length > 0) {
        await prisma.post.updateMany({
          where: { id: { in: postIds }, deletedAt: null },
          data: {
            summaryStatus: "QUEUED",
            summaryError: null,
            summaryJobId: retryTask.id,
            summaryModelId: retryTask.modelId,
          },
        });
        await resumePostSummaryJobs(retryTask.id);
      }
    } else if (retryTask.type === "post-bulk-completion") {
      await resumeAiBatchTasks(retryTask.id);
    } else {
      const metadata = retryTask.metadata && typeof retryTask.metadata === "object" ? (retryTask.metadata as { apply?: unknown }) : {};
      setTimeout(() => {
        void runAiBatchTask({ taskId: retryTask.id, modelId: retryTask.modelId, apply: metadata.apply === true }).catch((error) => {
          console.error("Run AI retry task error:", error);
        });
      }, 0);
    }

    return NextResponse.json({ success: true, data: retryTask }, { status: 202 });
  } catch (error) {
    return toErrorResponse(error, "AI task retry failed");
  }
}
