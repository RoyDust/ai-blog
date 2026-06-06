import { NextResponse } from "next/server";

import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { requireAdminSession } from "@/lib/api-auth";
import { toErrorResponse } from "@/lib/api-errors";
import {
  createNewsletterCampaign,
  listNewsletterCampaigns,
  previewNewsletterCampaign,
} from "@/lib/newsletter-campaigns";

async function GETHandler(request: Request) {
  try {
    await requireAdminSession();

    const { searchParams } = new URL(request.url);
    const campaigns = await listNewsletterCampaigns({
      page: searchParams.get("page"),
      limit: searchParams.get("limit"),
      status: searchParams.get("status"),
      q: searchParams.get("q"),
    });

    return NextResponse.json({ success: true, ...campaigns });
  } catch (error) {
    return toErrorResponse(error, "Failed to load newsletter campaigns");
  }
}

async function POSTHandler(request: Request) {
  try {
    const session = await requireAdminSession();
    const body = await request.json().catch(() => ({}));

    if (body?.intent === "preview") {
      const preview = await previewNewsletterCampaign(body);
      return NextResponse.json({ success: true, data: preview });
    }

    const campaign = await createNewsletterCampaign({
      title: body?.title,
      subject: body?.subject,
      intro: body?.intro,
      postIds: body?.postIds,
      scheduledAt: body?.scheduledAt,
      createdById: session.user.id,
    });

    return NextResponse.json({ success: true, data: campaign }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, "Failed to create newsletter campaign");
  }
}

export const GET = withApiOperationLogging(GETHandler, {
  scope: "admin",
  operation: "admin.newsletter.campaigns.read",
  route: "/api/admin/newsletter/campaigns",
});
export const POST = withApiOperationLogging(POSTHandler, {
  scope: "admin",
  operation: "admin.newsletter.campaigns.create",
  route: "/api/admin/newsletter/campaigns",
  captureRequestBody: true,
});
