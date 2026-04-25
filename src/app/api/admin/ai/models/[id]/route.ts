import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { deleteAiModel, toPublicAiModelOption, updateAiModel } from "@/lib/ai-models";
import { toErrorResponse } from "@/lib/api-errors";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireAdminSession();

    const { id } = await context.params;
    const model = await updateAiModel(id, await request.json());

    return NextResponse.json({ success: true, data: toPublicAiModelOption(model) });
  } catch (error) {
    return toErrorResponse(error, "AI model update failed");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    await requireAdminSession();

    const { id } = await context.params;
    await deleteAiModel(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, "AI model deletion failed");
  }
}
