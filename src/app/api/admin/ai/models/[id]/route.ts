import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { deleteAiModel, toPublicAiModelOption, updateAiModel } from "@/lib/ai-models";
import { toErrorResponse } from "@/lib/api-errors";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function PATCHHandler(request: Request, context: RouteContext) {
  try {
    await requireAdminSession();

    const { id } = await context.params;
    const model = await updateAiModel(id, await request.json());

    return NextResponse.json({ success: true, data: toPublicAiModelOption(model) });
  } catch (error) {
    return toErrorResponse(error, "AI model update failed");
  }
}

async function DELETEHandler(_request: Request, context: RouteContext) {
  try {
    await requireAdminSession();

    const { id } = await context.params;
    await deleteAiModel(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, "AI model deletion failed");
  }
}

export const PATCH = withApiOperationLogging(PATCHHandler, { scope: 'admin', operation: 'admin.ai.models.byId.update', route: '/api/admin/ai/models/[id]' });
export const DELETE = withApiOperationLogging(DELETEHandler, { scope: 'admin', operation: 'admin.ai.models.byId.delete', route: '/api/admin/ai/models/[id]' });
