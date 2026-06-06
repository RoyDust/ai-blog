import { NextResponse } from "next/server";

import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { requireAdminSession } from "@/lib/api-auth";
import { toErrorResponse } from "@/lib/api-errors";
import { getNewsletterCampaign, updateNewsletterCampaign } from "@/lib/newsletter-campaigns";

type CampaignRouteContext = {
  params: Promise<{ id: string }>;
};

async function GETHandler(_: Request, { params }: CampaignRouteContext) {
  try {
    await requireAdminSession();
    const { id } = await params;
    const campaign = await getNewsletterCampaign(id);

    return NextResponse.json({ success: true, data: campaign });
  } catch (error) {
    return toErrorResponse(error, "Failed to load newsletter campaign");
  }
}

async function PATCHHandler(request: Request, { params }: CampaignRouteContext) {
  try {
    await requireAdminSession();
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const campaign = await updateNewsletterCampaign(id, {
      title: body?.title,
      subject: body?.subject,
      intro: body?.intro,
      postIds: body?.postIds,
      scheduledAt: body?.scheduledAt,
    });

    return NextResponse.json({ success: true, data: campaign });
  } catch (error) {
    return toErrorResponse(error, "Failed to update newsletter campaign");
  }
}

export const GET = withApiOperationLogging<CampaignRouteContext>(GETHandler, {
  scope: "admin",
  operation: "admin.newsletter.campaigns.byId.read",
  route: "/api/admin/newsletter/campaigns/[id]",
});
export const PATCH = withApiOperationLogging<CampaignRouteContext>(PATCHHandler, {
  scope: "admin",
  operation: "admin.newsletter.campaigns.byId.update",
  route: "/api/admin/newsletter/campaigns/[id]",
  captureRequestBody: true,
});
