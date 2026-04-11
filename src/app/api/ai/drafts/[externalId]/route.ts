import { NextResponse } from "next/server";

import { requireAiClient } from "@/lib/ai-auth";
import { getAiDraft } from "@/lib/ai-authoring";
import { NotFoundError, toErrorResponse } from "@/lib/api-errors";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ externalId: string }> },
) {
  try {
    const client = await requireAiClient(request, "drafts:read");
    const { externalId } = await params;
    const draft = await getAiDraft({ client, externalId });

    if (!draft) {
      throw new NotFoundError("Draft not found");
    }

    return NextResponse.json({ success: true, data: draft });
  } catch (error) {
    return toErrorResponse(error);
  }
}
