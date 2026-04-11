import { NextResponse } from "next/server";

import { requireAiClient } from "@/lib/ai-auth";
import { upsertAiDraft } from "@/lib/ai-authoring";
import { toErrorResponse, ValidationError } from "@/lib/api-errors";
import { parseAiDraftInput } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const client = await requireAiClient(request, "drafts:write");
    let payload: unknown;

    try {
      payload = await request.json();
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new ValidationError("Malformed JSON body");
      }

      throw error;
    }

    const input = parseAiDraftInput(payload);
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
