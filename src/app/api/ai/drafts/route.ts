import { NextResponse } from "next/server";

import { requireAiClient } from "@/lib/ai-auth";
import { publishAiDraftPost, upsertAiDraft } from "@/lib/ai-authoring";
import { generatePostReview, isAutoPublishableReview } from "@/lib/ai-review";
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
    let published = false;
    let autoReview:
      | {
          verdict: "ready" | "needs-work";
          score: number;
          summary: string;
          published: boolean;
          error?: never;
        }
      | {
          verdict?: never;
          score?: never;
          summary?: never;
          published: false;
          error: string;
        }
      | null = null;

    try {
      const review = await generatePostReview({
        title: input.title,
        slug: input.slug,
        content: input.content,
        coverImage: input.coverImage,
      });

      if (review) {
        if (isAutoPublishableReview(review)) {
          await publishAiDraftPost({ postId: result.draft.postId });
          published = true;
        }

        autoReview = {
          verdict: review.verdict,
          score: review.score,
          summary: review.summary,
          published,
        };
      }
    } catch {
      autoReview = {
        published: false,
        error: "Automatic review failed",
      };
    }

    return NextResponse.json(
      {
        success: true,
        operation: result.operation,
        data: {
          ...result.draft,
          published,
        },
        autoReview,
      },
      { status: result.operation === "created" ? 201 : 200 },
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}
