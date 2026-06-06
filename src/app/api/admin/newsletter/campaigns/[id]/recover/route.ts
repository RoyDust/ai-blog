import { NextResponse } from "next/server";

import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { requireAdminSession } from "@/lib/api-auth";
import { toErrorResponse } from "@/lib/api-errors";
import { recoverSendingNewsletterCampaign } from "@/lib/newsletter-campaigns";

type CampaignRecoverRouteContext = {
  params: Promise<{ id: string }>;
};

async function POSTHandler(_: Request, { params }: CampaignRecoverRouteContext) {
  try {
    await requireAdminSession();
    const { id } = await params;
    const campaign = await recoverSendingNewsletterCampaign(id);

    return NextResponse.json({ success: true, data: campaign }, { status: 202 });
  } catch (error) {
    return toErrorResponse(error, "Failed to recover newsletter campaign");
  }
}

export const POST = withApiOperationLogging<CampaignRecoverRouteContext>(POSTHandler, {
  scope: "admin",
  operation: "admin.newsletter.campaigns.byId.recover.create",
  route: "/api/admin/newsletter/campaigns/[id]/recover",
});
