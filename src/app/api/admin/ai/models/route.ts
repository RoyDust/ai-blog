import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { createAiModel, getPublicAiModelOptions, toPublicAiModelOption } from "@/lib/ai-models";
import { toErrorResponse } from "@/lib/api-errors";

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

export async function POST(request: Request) {
  try {
    await requireAdminSession();

    const model = await createAiModel(await request.json());
    return NextResponse.json({ success: true, data: toPublicAiModelOption(model) }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "AI model creation failed");
  }
}
