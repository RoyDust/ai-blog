import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { authOptions } from "@/lib/auth";
import { toErrorResponse } from "@/lib/api-errors";
import { getRecommendedPostsForPost } from "@/lib/recommendations";
import { clampPagination } from "@/lib/validation";

export const dynamic = "force-dynamic";

async function getOptionalUserId() {
  try {
    const session = await getServerSession(authOptions);
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

async function GETHandler(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const postId = searchParams.get("postId")?.trim();

    if (!postId) {
      return NextResponse.json({ error: "postId is required" }, { status: 400 });
    }

    const { limit } = clampPagination({ page: "1", limit: searchParams.get("limit") });
    const excludeRead = searchParams.get("excludeRead") === "true";
    const userId = excludeRead ? await getOptionalUserId() : null;
    const posts = await getRecommendedPostsForPost({
      postId,
      limit,
      userId,
      excludeRead,
    });

    return NextResponse.json({ success: true, data: posts });
  } catch (error) {
    return toErrorResponse(error, "Recommendations unavailable");
  }
}

export const GET = withApiOperationLogging(GETHandler, {
  scope: "public",
  operation: "public.recommendations.read",
  route: "/api/recommendations",
});
