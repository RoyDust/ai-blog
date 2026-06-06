import { NextResponse } from "next/server";

import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { requireAdminSession } from "@/lib/api-auth";
import { isPrismaConflictError, toErrorResponse } from "@/lib/api-errors";
import { getAdminTopicGuideById, softDeleteTopicGuide, updateTopicGuide } from "@/lib/topic-guides";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function GETHandler(_request: Request, { params }: RouteContext) {
  try {
    await requireAdminSession();
    const { id } = await params;
    const guide = await getAdminTopicGuideById(id);

    return NextResponse.json({ success: true, data: guide });
  } catch (error) {
    return toErrorResponse(error, "Topic guide unavailable");
  }
}

async function PATCHHandler(request: Request, { params }: RouteContext) {
  try {
    await requireAdminSession();
    const { id } = await params;
    const guide = await updateTopicGuide(id, await request.json());

    return NextResponse.json({ success: true, data: guide });
  } catch (error) {
    if (isPrismaConflictError(error)) {
      return NextResponse.json({ error: "Topic guide slug already exists" }, { status: 409 });
    }
    return toErrorResponse(error, "Failed to update topic guide");
  }
}

async function DELETEHandler(_request: Request, { params }: RouteContext) {
  try {
    await requireAdminSession();
    const { id } = await params;
    await softDeleteTopicGuide(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return toErrorResponse(error, "Failed to delete topic guide");
  }
}

export const GET = withApiOperationLogging(GETHandler, {
  scope: "admin",
  operation: "admin.topic-guides.byId.read",
  route: "/api/admin/topic-guides/[id]",
});
export const PATCH = withApiOperationLogging(PATCHHandler, {
  scope: "admin",
  operation: "admin.topic-guides.byId.update",
  route: "/api/admin/topic-guides/[id]",
});
export const DELETE = withApiOperationLogging(DELETEHandler, {
  scope: "admin",
  operation: "admin.topic-guides.byId.delete",
  route: "/api/admin/topic-guides/[id]",
});
