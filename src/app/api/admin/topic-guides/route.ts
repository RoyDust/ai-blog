import { NextResponse } from "next/server";

import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { requireAdminSession } from "@/lib/api-auth";
import { toErrorResponse } from "@/lib/api-errors";
import { createTopicGuide, listAdminTopicGuides } from "@/lib/topic-guides";

async function GETHandler() {
  try {
    await requireAdminSession();
    const guides = await listAdminTopicGuides();

    return NextResponse.json({ success: true, data: guides });
  } catch (error) {
    return toErrorResponse(error, "Topic guides unavailable");
  }
}

async function POSTHandler(request: Request) {
  try {
    await requireAdminSession();
    const guide = await createTopicGuide(await request.json());

    return NextResponse.json({ success: true, data: guide });
  } catch (error) {
    return toErrorResponse(error, "Failed to create topic guide");
  }
}

export const GET = withApiOperationLogging(GETHandler, {
  scope: "admin",
  operation: "admin.topic-guides.read",
  route: "/api/admin/topic-guides",
});
export const POST = withApiOperationLogging(POSTHandler, {
  scope: "admin",
  operation: "admin.topic-guides.create",
  route: "/api/admin/topic-guides",
});
