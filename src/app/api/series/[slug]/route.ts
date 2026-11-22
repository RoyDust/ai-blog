import type { Prisma } from "@prisma/client";
import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { NotFoundError, toErrorResponse } from "@/lib/api-errors";
import { createPublicCachedReader, PUBLIC_CACHE_TAGS, PUBLIC_REVALIDATE_SECONDS } from "@/lib/cache";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const PUBLIC_SERIES_DETAIL_SELECT = {
  id: true,
  title: true,
  slug: true,
  description: true,
  coverImage: true,
  order: true,
  createdAt: true,
  updatedAt: true,
  posts: {
    where: {
      deletedAt: null,
      published: true,
    },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      coverImage: true,
      featured: true,
      createdAt: true,
      publishedAt: true,
      seriesOrder: true,
      viewCount: true,
      readingTimeMinutes: true,
      author: { select: { id: true, name: true, image: true } },
      category: { select: { id: true, name: true, slug: true, deletedAt: true } },
      tags: {
        where: { deletedAt: null },
        select: { id: true, name: true, slug: true },
      },
      _count: {
        select: {
          comments: { where: { deletedAt: null, status: "APPROVED" } },
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
} satisfies Prisma.SeriesSelect;

const getCachedPublicSeriesBySlug = createPublicCachedReader(
  async (slug: string) => {
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
      select: PUBLIC_SERIES_DETAIL_SELECT,
    });

    if (!series) {
      return null;
    }

    return {
      id: series.id,
      title: series.title,
      slug: series.slug,
      description: series.description ?? null,
      coverImage: series.coverImage ?? null,
      ...(series.order !== undefined ? { order: series.order } : {}),
      ...(series.createdAt !== undefined ? { createdAt: series.createdAt } : {}),
      ...(series.updatedAt !== undefined ? { updatedAt: series.updatedAt } : {}),
      posts: series.posts.map((post) => ({
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt ?? null,
        coverImage: post.coverImage ?? null,
        ...(post.featured !== undefined ? { featured: post.featured } : {}),
        ...(post.createdAt !== undefined ? { createdAt: post.createdAt } : {}),
        publishedAt: post.publishedAt ?? null,
        ...(post.seriesOrder !== undefined ? { seriesOrder: post.seriesOrder } : {}),
        ...(post.viewCount !== undefined ? { viewCount: post.viewCount } : {}),
        ...(post.readingTimeMinutes !== undefined ? { readingTimeMinutes: post.readingTimeMinutes } : {}),
        author: post.author
          ? {
              id: post.author.id,
              name: post.author.name ?? null,
              image: post.author.image ?? null,
            }
          : null,
        category:
          post.category && !post.category.deletedAt
            ? {
                id: post.category.id,
                name: post.category.name,
                slug: post.category.slug,
              }
            : null,
        tags: Array.isArray(post.tags)
          ? post.tags
              .filter((tag) => !(tag as { deletedAt?: Date | string | null }).deletedAt)
              .map((tag) => ({
                id: tag.id,
                name: tag.name,
                slug: tag.slug,
              }))
          : [],
        ...(post._count !== undefined
          ? {
              _count: {
                comments: post._count.comments ?? 0,
                likes: post._count.likes ?? 0,
              },
            }
          : {}),
      })),
      _count: {
        posts: series._count?.posts ?? series.posts.length,
      },
    };
  },
  {
    keyParts: ["public-api-series-detail"],
    revalidate: PUBLIC_REVALIDATE_SECONDS,
    tags: [PUBLIC_CACHE_TAGS.posts, PUBLIC_CACHE_TAGS.categories, PUBLIC_CACHE_TAGS.tags],
  },
);

async function GETHandler(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const publicSeries = await getCachedPublicSeriesBySlug(slug);

    if (!publicSeries) {
      throw new NotFoundError("Series not found");
    }

    return NextResponse.json({ success: true, data: publicSeries });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export const GET = withApiOperationLogging(GETHandler, {
  scope: "public",
  operation: "public.series.bySlug.read",
  route: "/api/series/[slug]",
});
