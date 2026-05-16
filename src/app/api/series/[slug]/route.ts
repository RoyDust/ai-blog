import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NotFoundError, toErrorResponse } from "@/lib/api-errors";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

async function GETHandler(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const series = await prisma.series.findFirst({
      where: {
        slug,
        deletedAt: null,
        posts: {
          some: {
            deletedAt: null,
            published: true,
          },
        },
      },
      include: {
        posts: {
          where: {
            deletedAt: null,
            published: true,
          },
          include: {
            author: { select: { id: true, name: true, image: true } },
            category: true,
            tags: { where: { deletedAt: null } },
            _count: {
              select: {
                comments: { where: { deletedAt: null } },
                likes: true,
              },
            },
          },
          orderBy: [{ seriesOrder: "asc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
        },
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
    });

    if (!series) {
      throw new NotFoundError("Series not found");
    }

    return NextResponse.json({ success: true, data: series });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export const GET = withApiOperationLogging(GETHandler, {
  scope: "public",
  operation: "public.series.bySlug.read",
  route: "/api/series/[slug]",
});
