export const revalidate = 300

import type { Metadata } from 'next'
import { HomeDiscoveryGrid, HomeHero, HomeLatestPosts } from '@/components/blog'
import { POSTS_PAGE_SIZE } from '@/lib/pagination'
import { getPublishedPostsPage } from '@/lib/posts'
import { prisma } from '@/lib/prisma'
import { buildPageMetadata } from '@/lib/seo'

export const metadata: Metadata = buildPageMetadata({
  title: 'My Blog',
  description: 'A modern blog system built with Next.js and Prisma.',
  path: '/',
})

async function getData() {
  const [postsPageResult, categoriesResult] = await Promise.allSettled([
    getPublishedPostsPage({ page: 1, limit: POSTS_PAGE_SIZE }),
    prisma.category.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { posts: { where: { deletedAt: null, published: true } } } } },
      orderBy: { posts: { _count: 'desc' } },
      take: 12,
    }),
  ])

  if (postsPageResult.status === 'rejected') {
    console.error('Load home posts error:', postsPageResult.reason)
  }

  if (categoriesResult.status === 'rejected') {
    console.error('Load home categories error:', categoriesResult.reason)
  }

  const postsPage =
    postsPageResult.status === 'fulfilled'
      ? postsPageResult.value
      : {
          posts: [],
          pagination: { page: 1, limit: POSTS_PAGE_SIZE, total: 0, totalPages: 0 },
        }

  const categories = categoriesResult.status === 'fulfilled' ? categoriesResult.value : []

  return {
    ...postsPage,
    categories,
    hasLoadError: postsPageResult.status === 'rejected' || categoriesResult.status === 'rejected',
  }
}

type HomePost = Awaited<ReturnType<typeof getData>>['posts'][number]
type HomeCategory = Awaited<ReturnType<typeof getData>>['categories'][number]

export default async function Home() {
  const { posts, categories, hasLoadError } = await getData()
  const [featuredPost, ...latestPosts] = posts as HomePost[]

  return (
    <div className="space-y-[var(--section-gap)]">
      {hasLoadError ? (
        <section role="alert" className="card-base border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          首页部分内容加载失败，请稍后重试。
        </section>
      ) : null}

      <HomeHero featuredPost={featuredPost ?? null} />
      <HomeLatestPosts posts={latestPosts.length > 0 ? latestPosts : featuredPost ? [featuredPost] : []} />
      <HomeDiscoveryGrid categories={categories as HomeCategory[]} />
    </div>
  )
}
