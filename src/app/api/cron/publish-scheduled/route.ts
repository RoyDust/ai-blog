import { withApiOperationLogging } from "@/lib/api-operation-log-route";
import { toErrorResponse } from "@/lib/api-errors"
import { revalidatePublicContent } from "@/lib/cache"
import { resolvePostCoverInput, touchCoverAssetUsage } from "@/lib/cover-assets"
import type { PostCoverResolution } from "@/lib/cover-assets"
import { requireInternalSecret } from "@/lib/internal-secrets"
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

function requireCronSecret(request: Request) {
  requireInternalSecret(request, {
    secretName: "PUBLISH_SCHEDULED_CRON_SECRET",
    envKeys: ["PUBLISH_SCHEDULED_CRON_SECRET", "CRON_SECRET", "AI_NEWS_CRON_SECRET"],
  })
}

async function POSTHandler(request: Request) {
  try {
    requireCronSecret(request)

    const now = new Date()

    // 候选读取与封面回填都必须发生在事务之外：cover-assets 走的是共享 prisma 连接，
    // 放进 $transaction 回调会和事务争抢连接池（默认 max=1），
    // 把交互式事务拖到 5s 超时报 "expired transaction"。
    const duePosts = await prisma.post.findMany({
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

    type DuePost = (typeof duePosts)[number]
    type PublishCandidate = {
      post: DuePost
      cover: PostCoverResolution | null
    }

    const candidates: PublishCandidate[] = []
    for (const post of duePosts) {
      const cover = post.coverImage?.trim() || post.coverAssetId
        ? null
        : await resolvePostCoverInput({ allowRandom: true })
      candidates.push({ post, cover })
    }

    const published = await prisma.$transaction(async (tx) => {
      const publishedPosts = []
      for (const { post, cover } of candidates) {
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
