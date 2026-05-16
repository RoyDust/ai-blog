import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { toErrorResponse } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

async function GETHandler() {
  try {
    const series = await prisma.series.findMany({
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
    });

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
