import { NextResponse } from "next/server";

import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { requireAdminSession } from "@/lib/api-auth";
import { toErrorResponse } from "@/lib/api-errors";
import { sendNewsletterCampaign } from "@/lib/newsletter-campaigns";

type CampaignSendRouteContext = {
  params: Promise<{ id: string }>;
};

async function POSTHandler(_: Request, { params }: CampaignSendRouteContext) {
  try {
    await requireAdminSession();
    const { id } = await params;
    const campaign = await sendNewsletterCampaign(id);

    return NextResponse.json({ success: true, data: campaign }, { status: 202 });
  } catch (error) {
    return toErrorResponse(error, "Failed to send newsletter campaign");
  }
}

export const POST = withApiOperationLogging<CampaignSendRouteContext>(POSTHandler, {
  scope: "admin",
  operation: "admin.newsletter.campaigns.byId.send.create",
  route: "/api/admin/newsletter/campaigns/[id]/send",
});
