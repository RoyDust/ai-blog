import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { applyPostAiTaskItem } from "@/lib/ai-post-actions";
import { toErrorResponse, ValidationError } from "@/lib/api-errors";

type Body = {
  itemId?: string;
};

/**
 * 应用一条已经生成成功的 AI 建议。
 *
 * 该入口只接收任务项 id；具体能否应用、写哪些文章字段由 applyPostAiTaskItem 统一判断。
 */
export async function POST(request: Request) {
  try {
    await requireAdminSession();

    const body = (await request.json()) as Body;
    if (!body.itemId) {
      throw new ValidationError("AI task item id is required");
    }

    const post = await applyPostAiTaskItem(body.itemId);

    return NextResponse.json({ success: true, data: post });
  } catch (error) {
    return toErrorResponse(error, "AI suggestion apply failed");
  }
}
