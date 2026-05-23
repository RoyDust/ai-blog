export const revalidate = 300

/**
 * 前台首页。
 *
 * 职责：
 * - 组合精选文章、最新文章、标签发现区等读者入口
 * - 尽量并发加载首页所需数据，并在局部失败时优雅降级
 * - 作为站点最重要的内容分发页，承担首屏阅读引导作用
 */

import type { Metadata } from 'next'
import { HomeAiDailyStrip, HomeLatestPosts } from '@/components/blog'
import { getBlogSettings } from '@/lib/blog-settings'
import { POSTS_PAGE_SIZE } from '@/lib/pagination'
import { getPublishedPostsPage } from '@/lib/posts'
import { prisma } from '@/lib/prisma'
import { buildPageMetadata, buildWebSiteJsonLd } from '@/lib/seo'
import { JsonLd } from '@/components/seo/JsonLd'

const HOME_LATEST_POST_LIMIT = 10

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getBlogSettings()

  return buildPageMetadata({
    title: settings.siteName,
    description: settings.siteDescription,
    path: '/',
    siteUrl: settings.siteUrl,
  })
}

/**
 * 并发加载首页数据。
 * 使用 Promise.allSettled 的原因是：即使某一块数据失败，也尽量保住首页其余内容可展示。
 */
async function getData() {
  const [postsPageResult, aiDailyResult] = await Promise.allSettled([
    getPublishedPostsPage({ page: 1, limit: Math.max(POSTS_PAGE_SIZE, 30) }),
    prisma.post.findMany({
      where: {
        deletedAt: null,
        published: true,
        series: { slug: 'ai-daily' },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        createdAt: true,
        publishedAt: true,
        seriesOrder: true,
      },
      orderBy: [{ seriesOrder: 'asc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 5,
    }),
  ])

  if (postsPageResult.status === 'rejected') {
    console.error('Load home posts error:', postsPageResult.reason)
  }

  if (aiDailyResult.status === 'rejected') {
    console.error('Load home AI daily error:', aiDailyResult.reason)
  }

  const postsPage =
    postsPageResult.status === 'fulfilled'
      ? postsPageResult.value
      : {
          posts: [],
          pagination: { page: 1, limit: POSTS_PAGE_SIZE, total: 0, totalPages: 0 },
        }

  const aiDailyPosts = aiDailyResult.status === 'fulfilled' ? aiDailyResult.value : []

  return {
    ...postsPage,
    aiDailyPosts,
    hasLoadError:
      postsPageResult.status === 'rejected' ||
      aiDailyResult.status === 'rejected',
  }
}

type HomePost = Awaited<ReturnType<typeof getData>>['posts'][number]

/**
 * 前台首页入口。
 * 负责把数据按“主阅读流 + 发现侧栏”的结构装配到首页组件树中。
 */
export default async function Home() {
  const [{ posts, aiDailyPosts, hasLoadError }, settings] = await Promise.all([getData(), getBlogSettings()])
  const latestPosts = (posts as HomePost[])
    .filter((post) => !post.slug.startsWith('ai-daily-'))
    .slice(0, HOME_LATEST_POST_LIMIT)
  const websiteJsonLd = buildWebSiteJsonLd({
    siteName: settings.siteName,
    siteUrl: settings.siteUrl,
    searchPath: '/search',
  })

  return (
    <div className="reader-home-stage space-y-5">
      <JsonLd data={websiteJsonLd} />
      {hasLoadError ? (
        <section
          role="alert"
          className="reader-panel border-[var(--danger-border)] bg-[var(--danger-surface)] p-4 text-sm text-[var(--danger-foreground)]"
        >
          首页部分内容加载失败，请稍后重试。
        </section>
      ) : null}

      <HomeAiDailyStrip posts={aiDailyPosts} />
      <HomeLatestPosts posts={latestPosts.length > 0 ? latestPosts : (posts as HomePost[]).slice(0, HOME_LATEST_POST_LIMIT)} />
    </div>
  )
}
