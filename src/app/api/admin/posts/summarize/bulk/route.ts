import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { toErrorResponse, ValidationError } from "@/lib/api-errors";
import {
  createPostSummaryJob,
  getPostSummaryJobSnapshot,
  resumePostSummaryJobs,
} from "@/lib/post-summary-jobs";

type BulkSummaryBody = {
  action?: string;
  resume?: boolean;
  jobId?: string;
  ids?: string[];
  modelId?: string;
};

async function parseOptionalJsonObject(request: Request): Promise<BulkSummaryBody> {
  const raw = await request.text();
  if (!raw.trim()) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ValidationError("Invalid JSON body");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ValidationError("Invalid JSON body");
  }

  return parsed as BulkSummaryBody;
}

async function GETHandler(request: Request) {
  try {
    await requireAdminSession();

    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get("jobId");

    return NextResponse.json({
      success: true,
      data: await getPostSummaryJobSnapshot(jobId),
    });
  } catch (error) {
    return toErrorResponse(error, "Bulk summary job status failed");
  }
}

async function POSTHandler(request: Request) {
  try {
    await requireAdminSession();

    const { searchParams } = new URL(request.url);
    const body = await parseOptionalJsonObject(request);

    if (body.action === "resume" || body.resume === true || searchParams.get("resume") === "1") {
      if (body.jobId !== undefined && body.jobId !== null && typeof body.jobId !== "string") {
        throw new ValidationError("Invalid jobId");
      }
      const jobId = typeof body.jobId === "string" ? body.jobId.trim() || null : searchParams.get("jobId");
      const resumed = await resumePostSummaryJobs(jobId);
      return NextResponse.json({ success: true, data: { resumed } }, { status: 202 });
    }

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

export const GET = withApiOperationLogging(GETHandler, { scope: 'admin', operation: 'admin.posts.summarize.bulk.read', route: '/api/admin/posts/summarize/bulk' });
export const POST = withApiOperationLogging(POSTHandler, { scope: 'admin', operation: 'admin.posts.summarize.bulk.create', route: '/api/admin/posts/summarize/bulk' });
