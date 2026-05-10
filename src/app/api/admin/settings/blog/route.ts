import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { toErrorResponse } from "@/lib/api-errors";
import { getBlogSettings, updateBlogSettings } from "@/lib/blog-settings";
import { revalidateBlogSettings } from "@/lib/cache";

async function GETHandler() {
  try {
    await requireAdminSession();
    const settings = await getBlogSettings();

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    return toErrorResponse(error, "Blog settings unavailable");
  }
}

async function PATCHHandler(request: Request) {
  try {
    await requireAdminSession();
    const body = await request.json().catch(() => ({}));
    const settings = await updateBlogSettings(body);
    revalidateBlogSettings();

    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    return toErrorResponse(error, "Blog settings update failed");
  }
}

export const GET = withApiOperationLogging(GETHandler, {
  scope: "admin",
  operation: "admin.settings.blog.read",
  route: "/api/admin/settings/blog",
});

export const PATCH = withApiOperationLogging(PATCHHandler, {
  scope: "admin",
  operation: "admin.settings.blog.update",
  route: "/api/admin/settings/blog",
});
