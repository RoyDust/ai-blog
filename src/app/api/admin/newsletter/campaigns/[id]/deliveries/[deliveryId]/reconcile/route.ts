import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/api-auth";
import { toErrorResponse } from "@/lib/api-errors";
import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { reconcileNewsletterDelivery } from "@/lib/newsletter-campaigns";

type Context = { params: Promise<{ id: string; deliveryId: string }> };
async function POSTHandler(request: Request, { params }: Context) {
  try {
    const session = await requireAdminSession();
    const { id, deliveryId } = await params;
    const body = await request.json().catch(() => ({}));
    const result = await reconcileNewsletterDelivery(id, deliveryId, session.user.id, {
      attemptId: body?.attemptId, decision: body?.decision, reason: body?.reason,
      evidenceKind: body?.evidenceKind, evidenceReference: body?.evidenceReference, senderStopped: body?.senderStopped,
    });
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return toErrorResponse(error, "邮件发送结果核对失败");
  }
}
export const POST = withApiOperationLogging<Context>(POSTHandler, {
  scope: "admin", operation: "admin.newsletter.deliveries.reconcile",
  route: "/api/admin/newsletter/campaigns/[id]/deliveries/[deliveryId]/reconcile",
});
