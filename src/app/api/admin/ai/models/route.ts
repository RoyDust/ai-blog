import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { createAiModel, getPublicAiModelOptions, toPublicAiModelOption } from "@/lib/ai-models";
import { toErrorResponse } from "@/lib/api-errors";

/**
 * 查询后台可展示的 AI 模型配置。
 *
 * 返回值会隐藏密钥明文，只暴露前端配置页需要的状态和能力字段。
 */
export async function GET() {
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

/**
 * 创建 AI 模型配置。
 *
 * 输入归一化、密钥加密和默认模型约束由 ai-models 服务处理。
 */
export async function POST(request: Request) {
  try {
    await requireAdminSession();

    const model = await createAiModel(await request.json());
    return NextResponse.json({ success: true, data: toPublicAiModelOption(model) }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "AI model creation failed");
  }
}
