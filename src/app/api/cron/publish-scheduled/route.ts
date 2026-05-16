import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { toErrorResponse, UnauthorizedError } from "@/lib/api-errors"
import { revalidatePublicContent } from "@/lib/cache"
import { resolvePostCoverInput, touchCoverAssetUsage } from "@/lib/cover-assets"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

function getConfiguredCronSecret() {
  return (
    process.env.PUBLISH_SCHEDULED_CRON_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    process.env.AI_NEWS_CRON_SECRET?.trim()
  )
}

function requireCronSecret(request: Request) {
  const configuredSecret = getConfiguredCronSecret()
  if (!configuredSecret) {
    throw new Error("PUBLISH_SCHEDULED_CRON_SECRET or CRON_SECRET is not configured")
  }

  const authorization = request.headers.get("authorization") ?? ""
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  if (token !== configuredSecret) {
    throw new UnauthorizedError()
  }
}

async function POSTHandler(request: Request) {
  try {
    requireCronSecret(request)

    const now = new Date()
    const published = await prisma.$transaction(async (tx) => {
      const duePosts = await tx.post.findMany({
        where: {
          deletedAt: null,
          published: false,
          scheduledAt: { lte: now },
        },
        orderBy: { scheduledAt: "asc" },
        select: {
          id: true,
          slug: true,
          coverImage: true,
          coverAssetId: true,
          category: { select: { slug: true } },
          series: { select: { slug: true } },
          tags: { where: { deletedAt: null }, select: { slug: true } },
        },
      })

      const publishedPosts = []
      for (const post of duePosts) {
        const cover = post.coverImage?.trim() || post.coverAssetId
          ? null
          : await resolvePostCoverInput({ allowRandom: true })
        const data = {
          published: true,
          publishedAt: now,
          scheduledAt: null,
          ...(cover?.coverImage !== undefined ? { coverImage: cover.coverImage } : {}),
          ...(cover?.coverAssetId !== undefined ? { coverAssetId: cover.coverAssetId } : {}),
        }
        const result = await tx.post.updateMany({
          where: {
            id: post.id,
            deletedAt: null,
            published: false,
            scheduledAt: { lte: now },
          },
          data,
        })

        if (result.count === 0) {
          continue
        }

        const updated = await tx.post.findUnique({
          where: { id: post.id },
          select: {
            id: true,
            slug: true,
            published: true,
            publishedAt: true,
            scheduledAt: true,
            category: { select: { slug: true } },
            series: { select: { slug: true } },
            tags: { where: { deletedAt: null }, select: { slug: true } },
          },
        })

        if (updated) {
          publishedPosts.push({ post: updated, selectedAssetId: cover?.selectedAssetId ?? null })
        }
      }

      return publishedPosts
    })

    for (const { post, selectedAssetId } of published) {
      await touchCoverAssetUsage(selectedAssetId)
      revalidatePublicContent({
        slug: post.slug,
        categorySlug: post.category?.slug,
        seriesSlug: post.series?.slug,
        tagSlugs: post.tags.map((tag: { slug: string }) => tag.slug),
      })
    }

    return NextResponse.json({
      success: true,
      data: {
        publishedCount: published.length,
        posts: published.map(({ post }) => ({
          id: post.id,
          slug: post.slug,
          publishedAt: post.publishedAt,
        })),
      },
    })
  } catch (error) {
    return toErrorResponse(error, error instanceof Error ? error.message : "Scheduled publish cron failed")
  }
}

export const POST = withApiOperationLogging(POSTHandler, { scope: 'cron', operation: 'cron.publishScheduled.create', route: '/api/cron/publish-scheduled' });
