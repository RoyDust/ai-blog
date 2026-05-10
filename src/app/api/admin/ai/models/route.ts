import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { createAiModel, getPublicAiModelOptions, toPublicAiModelOption } from "@/lib/ai-models";
import { toErrorResponse } from "@/lib/api-errors";

async function GETHandler() {
  try {
    await requireAdminSession();

    return NextResponse.json({
      success: true,
      data: await getPublicAiModelOptions(),
    });
  } catch (error) {
    return toErrorResponse(error, "AI models unavailable");
  }
}

async function POSTHandler(request: Request) {
  try {
    await requireAdminSession();

    const model = await createAiModel(await request.json());
    return NextResponse.json({ success: true, data: toPublicAiModelOption(model) }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "AI model creation failed");
  }
}

export const GET = withApiOperationLogging(GETHandler, { scope: 'admin', operation: 'admin.ai.models.read', route: '/api/admin/ai/models' });
export const POST = withApiOperationLogging(POSTHandler, { scope: 'admin', operation: 'admin.ai.models.create', route: '/api/admin/ai/models' });
