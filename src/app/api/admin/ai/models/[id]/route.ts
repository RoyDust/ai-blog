import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { deleteAiModel, toPublicAiModelOption, updateAiModel } from "@/lib/ai-models";
import { toErrorResponse } from "@/lib/api-errors";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * 更新 AI 模型配置。
 *
 * 允许局部更新展示名、模型参数、能力、状态和密钥字段。
 */
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

/**
 * 删除 AI 模型配置。
 *
 * 服务层会阻止删除当前默认模型，避免运行时能力缺少可用模型。
 */
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
