import { NextResponse } from "next/server";

import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { requireAdminSession } from "@/lib/api-auth";
import { toErrorResponse } from "@/lib/api-errors";
import { listNewsletterSubscribers } from "@/lib/newsletter-campaigns";

async function GETHandler(request: Request) {
  try {
    await requireAdminSession();

    const { searchParams } = new URL(request.url);
    const subscribers = await listNewsletterSubscribers({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
      status: searchParams.get("status"),
      q: searchParams.get("q"),
    });

    return NextResponse.json({ success: true, ...subscribers });
  } catch (error) {
    return toErrorResponse(error, "Failed to load newsletter subscribers");
  }
}

export const GET = withApiOperationLogging(GETHandler, {
  scope: "admin",
  operation: "admin.newsletter.subscribers.read",
  route: "/api/admin/newsletter/subscribers",
});
