import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { toErrorResponse } from "@/lib/api-errors";
import { createPublicCachedReader, PUBLIC_CACHE_TAGS, PUBLIC_REVALIDATE_SECONDS } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const getCachedPublicSeriesList = createPublicCachedReader(
  async () =>
    prisma.series.findMany({
      where: {
        deletedAt: null,
        posts: {
          some: {
            deletedAt: null,
            published: true,
          },
        },
      },
      include: {
        _count: {
          select: {
            posts: {
              where: {
                deletedAt: null,
                published: true,
              },
            },
          },
        },
      },
      orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    }),
  {
    keyParts: ["public-api-series-list"],
    revalidate: PUBLIC_REVALIDATE_SECONDS,
    tags: [PUBLIC_CACHE_TAGS.posts],
  },
);

async function GETHandler() {
  try {
    const series = await getCachedPublicSeriesList();

    return NextResponse.json({ success: true, data: series });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export const GET = withApiOperationLogging(GETHandler, {
  scope: "public",
  operation: "public.series.read",
  route: "/api/series",
});
