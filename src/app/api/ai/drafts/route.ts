import { NextResponse } from "next/server";

import { requireAiClient } from "@/lib/ai-auth";
import { upsertAiDraft } from "@/lib/ai-authoring";
import { toErrorResponse } from "@/lib/api-errors";
import { parseAiDraftInput } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const client = await requireAiClient(request, "drafts:write");
    const input = parseAiDraftInput(await request.json());
    const result = await upsertAiDraft({ client, input });

    return NextResponse.json(
      {
        success: true,
        operation: result.operation,
        data: result.draft,
      },
      { status: result.operation === "created" ? 201 : 200 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
