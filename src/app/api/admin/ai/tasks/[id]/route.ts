import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { getAiTaskDetail } from "@/lib/ai-tasks";
import { toErrorResponse } from "@/lib/api-errors";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdminSession();

    const { id } = await params;
    const task = await getAiTaskDetail(id);

    return NextResponse.json({ success: true, data: task });
  } catch (error) {
    return toErrorResponse(error, "AI task detail failed");
  }
}
