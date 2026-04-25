import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { toErrorResponse } from "@/lib/api-errors";
import {
  createPostSummaryJob,
  getPostSummaryJobSnapshot,
  resumePostSummaryJobs,
} from "@/lib/post-summary-jobs";

type BulkSummaryBody = {
  ids?: string[];
  modelId?: string;
};

export async function GET(request: Request) {
  try {
    await requireAdminSession();

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    if (searchParams.get("resume") === "1") {
      await resumePostSummaryJobs(jobId);
    }

    return NextResponse.json({
      success: true,
      data: await getPostSummaryJobSnapshot(jobId),
    });
  } catch (error) {
    return toErrorResponse(error, "Bulk summary job status failed");
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminSession();

    const body = (await request.json()) as BulkSummaryBody;
    const job = await createPostSummaryJob({ ids: body.ids, modelId: body.modelId });

    return NextResponse.json(
      {
        success: true,
        data: {
          ...job,
          status: job.queued > 0 ? "queued" : "finished",
        },
      },
      { status: 202 },
    );
  } catch (error) {
    return toErrorResponse(error, "Bulk summary generation failed");
  }
}
