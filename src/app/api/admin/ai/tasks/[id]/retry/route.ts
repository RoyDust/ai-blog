import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { retryAiTaskFailedItems } from "@/lib/ai-tasks";
import { resumeAiBatchTasks } from "@/lib/ai-batch-jobs";
import { resumePostSummaryJobs } from "@/lib/post-summary-jobs";
import { toErrorResponse } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";

async function POSTHandler(_: Request, { params }: { params: Promise<{ id: string }> }) {
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
      await resumeAiBatchTasks(retryTask.id);
    }

    return NextResponse.json({ success: true, data: retryTask }, { status: 202 });
  } catch (error) {
    return toErrorResponse(error, "AI task retry failed");
  }
}

export const POST = withApiOperationLogging(POSTHandler, { scope: 'admin', operation: 'admin.ai.tasks.byId.retry.create', route: '/api/admin/ai/tasks/[id]/retry' });
