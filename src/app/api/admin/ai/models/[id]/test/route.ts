import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { getAiModelOption, recordAiModelTestResult, testAiModelConnection } from "@/lib/ai-models";
import { toErrorResponse, ValidationError } from "@/lib/api-errors";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    await requireAdminSession();

    const { id } = await context.params;
    const model = await getAiModelOption(id);

    if (!model) {
      throw new ValidationError("AI model not found");
    }

    try {
      const sample = await testAiModelConnection(model);
      const message = `连接成功：${sample.slice(0, 120)}`;
      await recordAiModelTestResult(id, "success", message);
      return NextResponse.json({ success: true, data: { message, sample } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Model test failed";
      await recordAiModelTestResult(id, "failed", message);
      return NextResponse.json({ error: message }, { status: error instanceof ValidationError ? error.status : 502 });
    }
  } catch (error) {
    return toErrorResponse(error, "AI model test failed");
  }
}
