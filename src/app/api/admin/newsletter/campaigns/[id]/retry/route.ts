import { NextResponse } from "next/server";

import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { requireAdminSession } from "@/lib/api-auth";
import { toErrorResponse } from "@/lib/api-errors";
import { retryNewsletterCampaignFailures } from "@/lib/newsletter-campaigns";

type CampaignRetryRouteContext = {
  params: Promise<{ id: string }>;
};

async function POSTHandler(_: Request, { params }: CampaignRetryRouteContext) {
  try {
    await requireAdminSession();
    const { id } = await params;
    const campaign = await retryNewsletterCampaignFailures(id);

    return NextResponse.json({ success: true, data: campaign }, { status: 202 });
  } catch (error) {
    return toErrorResponse(error, "Failed to retry newsletter campaign");
  }
}

export const POST = withApiOperationLogging<CampaignRetryRouteContext>(POSTHandler, {
  scope: "admin",
  operation: "admin.newsletter.campaigns.byId.retry.create",
  route: "/api/admin/newsletter/campaigns/[id]/retry",
});
