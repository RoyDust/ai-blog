import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { toErrorResponse, ValidationError } from "@/lib/api-errors";
import { setDefaultAiModelForCapability, toPublicAiModelOption, type AiModelCapability } from "@/lib/ai-models";

type Body = {
  modelId?: string;
  capability?: AiModelCapability;
};

async function POSTHandler(request: Request) {
  try {
    await requireAdminSession();

    const body = (await request.json()) as Body;
    if (!body.modelId) {
      throw new ValidationError("Model id is required");
    }

    const capability = body.capability ?? "post-summary";
    if (capability !== "post-summary" && capability !== "cover-image") {
      throw new ValidationError("Unsupported AI model capability");
    }

    const model = await setDefaultAiModelForCapability(capability, body.modelId);

    return NextResponse.json({ success: true, data: toPublicAiModelOption(model) });
  } catch (error) {
    return toErrorResponse(error, "AI model default switch failed");
  }
}

export const POST = withApiOperationLogging(POSTHandler, { scope: 'admin', operation: 'admin.ai.models.default.create', route: '/api/admin/ai/models/default' });
