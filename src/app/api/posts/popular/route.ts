import { NextResponse } from "next/server";
import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { toErrorResponse } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";

export const revalidate = 300;

async function GETHandler() {
  try {
    const posts = await prisma.post.findMany({
      where: { published: true, deletedAt: null, viewCount: { gt: 0 } },
      select: { id: true, title: true, slug: true, viewCount: true },
      orderBy: { viewCount: "desc" },
      take: 5,
    });

    return NextResponse.json({ success: true, data: posts });
  } catch (error) {
    return toErrorResponse(error, "Popular posts unavailable");
  }
}

export const GET = withApiOperationLogging(GETHandler, {
  scope: "public",
  operation: "public.posts.popular.read",
  route: "/api/posts/popular",
});
