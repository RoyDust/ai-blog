import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { applyPostAiTaskItem } from "@/lib/ai-post-actions";
import { toErrorResponse, ValidationError } from "@/lib/api-errors";

type Body = {
  itemId?: string;
};

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
