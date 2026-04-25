import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { listAiTasks } from "@/lib/ai-tasks";
import { toErrorResponse } from "@/lib/api-errors";

export async function GET(request: Request) {
  try {
    await requireAdminSession();

    const { searchParams } = new URL(request.url);
    const data = await listAiTasks({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
      status: searchParams.get("status"),
      type: searchParams.get("type"),
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return toErrorResponse(error, "AI task list failed");
  }
}
