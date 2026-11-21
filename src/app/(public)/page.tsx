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
import { HomeAiDailyStrip, HomeEditorialHero, HomeLatestPosts, NewsletterForm } from '@/components/blog'
import { HomeDiscovery } from '@/components/blog/HomeDiscovery'
import { HomeSeriesGuides, type HomeGuideItem, type HomeSeriesItem } from '@/components/blog/HomeSeriesGuides'
import { getBlogSettings } from '@/lib/blog-settings'
import { getHomeLatestPosts } from '@/lib/posts'
import { prisma } from '@/lib/prisma'
import { listPublicTopicGuides } from '@/lib/topic-guides'
import { buildPageMetadata, buildWebSiteJsonLd } from '@/lib/seo'
import { JsonLd } from '@/components/seo/JsonLd'

const HOME_LATEST_POST_LIMIT = 5
const HOME_SERIES_LIMIT = 3
const HOME_GUIDE_LIMIT = 2
const AI_DAILY_SERIES_SLUG = 'ai-daily'

const publishedPostWhere = { deletedAt: null, published: true } as const

async function getHomeSeries(): Promise<HomeSeriesItem[]> {
  const series = await prisma.series.findMany({
    where: { deletedAt: null, posts: { some: publishedPostWhere } },
    select: {
      id: true,
      title: true,
      slug: true,
      _count: { select: { posts: { where: publishedPostWhere } } },
      posts: {
        where: publishedPostWhere,
        select: { title: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 1,
      },
    },
    orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    take: HOME_SERIES_LIMIT,
  })

  return series.map((item) => ({
    id: item.id,
    title: item.title,
    slug: item.slug,
    postCount: item._count.posts,
    latestPostTitle: item.posts[0]?.title ?? null,
    isDaily: item.slug === AI_DAILY_SERIES_SLUG,
  }))
}

async function getHomeGuides(): Promise<HomeGuideItem[]> {
  const guides = await listPublicTopicGuides()
  return guides.slice(0, HOME_GUIDE_LIMIT).map((guide) => ({
    id: guide.id,
    title: guide.title,
    slug: guide.slug,
    description: guide.description,
  }))
}

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
  const [latestPostsResult, aiDailyResult, seriesResult, guidesResult] = await Promise.allSettled([
    // 多取一篇：第一篇进精选，其余 5 篇进「最新文章」
    getHomeLatestPosts(HOME_LATEST_POST_LIMIT + 1),
    prisma.post.findMany({
      where: {
        deletedAt: null,
        published: true,
        generatedByAiNews: true,
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
    getHomeSeries(),
    getHomeGuides(),
  ])

  if (latestPostsResult.status === 'rejected') {
    console.error('Load home posts error:', latestPostsResult.reason)
  }

  if (aiDailyResult.status === 'rejected') {
    console.error('Load home AI daily error:', aiDailyResult.reason)
  }

  if (seriesResult.status === 'rejected') {
    console.error('Load home series error:', seriesResult.reason)
  }

  if (guidesResult.status === 'rejected') {
    console.error('Load home guides error:', guidesResult.reason)
  }

  const posts = latestPostsResult.status === 'fulfilled' ? latestPostsResult.value : []
  const aiDailyPosts = aiDailyResult.status === 'fulfilled' ? aiDailyResult.value : []

  return {
    posts,
    aiDailyPosts,
    series: seriesResult.status === 'fulfilled' ? seriesResult.value : [],
    guides: guidesResult.status === 'fulfilled' ? guidesResult.value : [],
    hasLoadError:
      latestPostsResult.status === 'rejected' ||
      aiDailyResult.status === 'rejected',
  }
}

/**
 * 前台首页入口。
 * 负责把数据按“主阅读流 + 发现侧栏”的结构装配到首页组件树中。
 */
export default async function Home() {
  const [{ posts, aiDailyPosts, series, guides, hasLoadError }, settings] = await Promise.all([getData(), getBlogSettings()])
  const featuredPost = posts.find((post) => post.featured) ?? posts[0] ?? null
  const latestPosts = posts.filter((post) => post !== featuredPost).slice(0, HOME_LATEST_POST_LIMIT)
  const websiteJsonLd = buildWebSiteJsonLd({
    siteName: settings.siteName,
    siteUrl: settings.siteUrl,
    searchPath: '/search',
  })

  return (
    <div className="reader-home-stage space-y-[1.75rem] sm:space-y-9">
      <JsonLd data={websiteJsonLd} />
      {hasLoadError ? (
        <p role="alert" className="ed-banner ed-banner--danger">
          首页部分内容加载失败，请稍后重试。
        </p>
      ) : null}

      <HomeEditorialHero
        post={featuredPost}
        siteDescription={settings.siteDescription}
        siteName={settings.siteName}
      />
      <HomeAiDailyStrip posts={aiDailyPosts} />
      <HomeLatestPosts posts={latestPosts} />
      <HomeSeriesGuides guides={guides} series={series} />
      <HomeDiscovery />
      <NewsletterForm />
    </div>
  )
}
