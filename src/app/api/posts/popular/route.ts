import { NextResponse } from "next/server";
import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { toErrorResponse } from "@/lib/api-errors";
import { createPublicCachedReader, PUBLIC_CACHE_TAGS, PUBLIC_REVALIDATE_SECONDS } from "@/lib/cache";
import { prisma } from "@/lib/prisma";

export const revalidate = 300;
const POPULAR_POST_LIMIT = 3;

const getCachedPopularPosts = createPublicCachedReader(
  async () =>
    prisma.post.findMany({
      where: { published: true, deletedAt: null, viewCount: { gt: 0 } },
      select: { id: true, title: true, slug: true, viewCount: true },
      orderBy: { viewCount: "desc" },
      take: POPULAR_POST_LIMIT,
    }),
  {
    keyParts: ["public-api-popular-posts"],
    revalidate: PUBLIC_REVALIDATE_SECONDS,
    tags: [PUBLIC_CACHE_TAGS.posts],
  },
);

async function GETHandler() {
  try {
    const posts = await getCachedPopularPosts();

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
