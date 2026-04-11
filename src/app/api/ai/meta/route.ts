import { NextResponse } from "next/server";

import { requireAiClient } from "@/lib/ai-auth";
import { AI_AUTHORING_LIMITS, AI_AUTHORING_VERSION } from "@/lib/ai-contract";
import { toErrorResponse } from "@/lib/api-errors";
import { getCategoryDirectory, getTagDirectory } from "@/lib/taxonomy";

export async function GET(request: Request) {
  try {
    await requireAiClient(request, "taxonomy:read");

    const [categories, tags] = await Promise.all([
      getCategoryDirectory(),
      getTagDirectory(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        version: AI_AUTHORING_VERSION,
        limits: AI_AUTHORING_LIMITS,
        categories: categories.map((category) => ({
          name: category.name,
          slug: category.slug,
          postCount: category._count.posts,
        })),
        tags: tags.map((tag) => ({
          name: tag.name,
          slug: tag.slug,
          postCount: tag._count.posts,
        })),
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
