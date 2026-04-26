import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { toErrorResponse } from "@/lib/api-errors";
import { setDefaultAiModelForCapability, toPublicAiModelOption } from "@/lib/ai-models";

type Body = {
  modelId?: string;
  capability?: "post-summary";
};

export async function POST(request: Request) {
  try {
    await requireAdminSession();

    const body = (await request.json()) as Body;
    if (!body.modelId) {
      return NextResponse.json({ error: "Model id is required" }, { status: 400 });
    }

    const model = await setDefaultAiModelForCapability(body.capability ?? "post-summary", body.modelId);

    return NextResponse.json({ success: true, data: toPublicAiModelOption(model) });
  } catch (error) {
    return toErrorResponse(error, "AI model default switch failed");
  }
}
