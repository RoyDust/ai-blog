import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/api-auth";
import { toErrorResponse } from "@/lib/api-errors";
import { generateAiCoverImage, type AiCoverSize } from "@/lib/ai-cover-image";
import { checkAiCoverRateLimit } from "@/lib/rate-limit";

const allowedSizes = new Set<AiCoverSize>(["16:9", "1:1", "4:3"]);

function optionalString(value: unknown, maxLength: number) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

async function POSTHandler(request: Request) {
  try {
    const rateLimit = await checkAiCoverRateLimit(request);
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: "Too many requests" }, { status: 429 });
    }

    const session = await requireAdminSession();
    const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const size = allowedSizes.has(payload.size as AiCoverSize) ? payload.size as AiCoverSize : "16:9";

    const asset = await generateAiCoverImage({
      title: optionalString(payload.title, 160) ?? "",
      excerpt: optionalString(payload.excerpt, 500),
      content: optionalString(payload.content, 2000),
      prompt: optionalString(payload.prompt, 500),
      modelId: optionalString(payload.modelId, 160),
      size,
      createdById: session.user.id,
    });

    return NextResponse.json({ success: true, data: asset });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export const POST = withApiOperationLogging(POSTHandler, { scope: 'admin', operation: 'admin.covers.generate.create', route: '/api/admin/covers/generate' });
