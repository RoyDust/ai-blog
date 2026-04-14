export const revalidate = 300

import type { Metadata } from 'next'
import { HomeDiscoveryGrid, HomeFeaturedGrid, HomeLatestPosts } from '@/components/blog'
import { POSTS_PAGE_SIZE } from '@/lib/pagination'
import { getFeaturedPosts, getPublishedPostsPage } from '@/lib/posts'
import { prisma } from '@/lib/prisma'
import { buildPageMetadata } from '@/lib/seo'

export const metadata: Metadata = buildPageMetadata({
  title: 'My Blog',
  description: 'A modern blog system built with Next.js and Prisma.',
  path: '/',
})

async function getData() {
  const [postsPageResult, categoriesResult, featuredResult] = await Promise.allSettled([
    getPublishedPostsPage({ page: 1, limit: POSTS_PAGE_SIZE }),
    prisma.category.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { posts: { where: { deletedAt: null, published: true } } } } },
      orderBy: { posts: { _count: 'desc' } },
      take: 12,
    }),
    getFeaturedPosts(3),
  ])

  if (postsPageResult.status === 'rejected') {
    console.error('Load home posts error:', postsPageResult.reason)
  }

  if (categoriesResult.status === 'rejected') {
    console.error('Load home categories error:', categoriesResult.reason)
  }

  if (featuredResult.status === 'rejected') {
    console.error('Load home featured posts error:', featuredResult.reason)
  }

  const postsPage =
    postsPageResult.status === 'fulfilled'
      ? postsPageResult.value
      : {
          posts: [],
          pagination: { page: 1, limit: POSTS_PAGE_SIZE, total: 0, totalPages: 0 },
        }

  const categories = categoriesResult.status === 'fulfilled' ? categoriesResult.value : []
  const featuredPosts = featuredResult.status === 'fulfilled' ? featuredResult.value : []

  return {
    ...postsPage,
    featuredPosts,
    categories,
    hasLoadError:
      postsPageResult.status === 'rejected' ||
      categoriesResult.status === 'rejected' ||
      featuredResult.status === 'rejected',
  }
}

type HomePost = Awaited<ReturnType<typeof getData>>['posts'][number]
type HomeCategory = Awaited<ReturnType<typeof getData>>['categories'][number]

export default async function Home() {
  const { posts, featuredPosts, categories, hasLoadError } = await getData()
  const [featuredLead, ...featuredSecondary] = featuredPosts as HomePost[]
  const featuredIds = new Set(featuredPosts.map((post) => post.id))
  const latestPosts = posts.filter((post) => !featuredIds.has(post.id)).slice(0, 4)

  return (
    <div className="space-y-[var(--section-gap)]">
      {hasLoadError ? (
        <section role="alert" className="card-base border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          首页部分内容加载失败，请稍后重试。
        </section>
      ) : null}

      <HomeFeaturedGrid leadPost={featuredLead ?? null} secondaryPosts={featuredSecondary.slice(0, 2)} />
      <HomeLatestPosts posts={latestPosts} />
      <HomeDiscoveryGrid categories={categories as HomeCategory[]} />
    </div>
  )
}
