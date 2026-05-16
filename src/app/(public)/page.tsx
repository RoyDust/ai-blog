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
import { HomeDiscoveryGrid, HomeLatestPosts, NewsletterForm, SectionHeader } from '@/components/blog'
import { HomeReaderBanner } from '@/components/blog/HomeReaderBanner'
import { getBlogSettings } from '@/lib/blog-settings'
import { POSTS_PAGE_SIZE } from '@/lib/pagination'
import { getFeaturedPosts, getPublishedPostsPage } from '@/lib/posts'
import { prisma } from '@/lib/prisma'
import { buildPageMetadata } from '@/lib/seo'

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
  const [postsPageResult, categoriesResult, tagsResult, featuredResult] = await Promise.allSettled([
    getPublishedPostsPage({ page: 1, limit: POSTS_PAGE_SIZE }),
    prisma.category.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { posts: { where: { deletedAt: null, published: true } } } } },
      orderBy: { posts: { _count: 'desc' } },
      take: 12,
    }),
    prisma.tag.findMany({
      where: { deletedAt: null },
      include: { _count: { select: { posts: { where: { deletedAt: null, published: true } } } } },
      orderBy: { posts: { _count: 'desc' } },
      take: 18,
    }),
    getFeaturedPosts(4),
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

  if (tagsResult.status === 'rejected') {
    console.error('Load home tags error:', tagsResult.reason)
  }

  const postsPage =
    postsPageResult.status === 'fulfilled'
      ? postsPageResult.value
      : {
          posts: [],
          pagination: { page: 1, limit: POSTS_PAGE_SIZE, total: 0, totalPages: 0 },
        }

  const categories = categoriesResult.status === 'fulfilled' ? categoriesResult.value : []
  const tags = tagsResult.status === 'fulfilled' ? tagsResult.value : []
  const featuredPosts = featuredResult.status === 'fulfilled' ? featuredResult.value : []

  return {
    ...postsPage,
    featuredPosts,
    categories,
    tags,
    hasLoadError:
      postsPageResult.status === 'rejected' ||
      categoriesResult.status === 'rejected' ||
      tagsResult.status === 'rejected' ||
      featuredResult.status === 'rejected',
  }
}

type HomePost = Awaited<ReturnType<typeof getData>>['posts'][number]
type HomeTag = Awaited<ReturnType<typeof getData>>['tags'][number]

/**
 * 前台首页入口。
 * 负责把数据按“主阅读流 + 发现侧栏”的结构装配到首页组件树中。
 */
export default async function Home() {
  const { posts, featuredPosts, tags, hasLoadError } = await getData()
  const settings = await getBlogSettings()
  const [featuredLead] = featuredPosts as HomePost[]
  const featuredIds = new Set(featuredPosts.map((post) => post.id))
  const latestPosts = posts.filter((post) => !featuredIds.has(post.id)).slice(0, 5)
  const latestPost = posts[0] ?? null

  return (
    <div className="space-y-6">
      {hasLoadError ? (
        <section
          role="alert"
          className="reader-panel border-[var(--danger-border)] bg-[var(--danger-surface)] p-4 text-sm text-[var(--danger-foreground)]"
        >
          首页部分内容加载失败，请稍后重试。
        </section>
      ) : null}

      <div className="grid gap-[var(--layout-rail-gap)] xl:grid-cols-[minmax(0,1fr)_minmax(22rem,24rem)] xl:items-start">
        <div className="min-w-0 space-y-[var(--section-gap)]">
          <HomeReaderBanner
            posts={(featuredPosts as HomePost[]).slice(0, 4)}
            leadPost={featuredLead ?? null}
            latestPost={latestPost}
          />
          {settings.newsletter.enabled ? (
            <section className="reader-panel space-y-4 p-6 sm:p-8">
              <SectionHeader
                eyebrow="Newsletter"
                title="订阅最新文章"
                description="通过邮件确认后接收新内容提醒，随时可以退订。"
              />
              <NewsletterForm />
            </section>
          ) : null}
          <HomeLatestPosts posts={latestPosts} />
        </div>

        <HomeDiscoveryGrid leadPost={featuredLead ?? latestPost} latestPosts={(latestPosts.length > 0 ? latestPosts : posts).slice(0, 5)} tags={tags as HomeTag[]} />
      </div>
    </div>
  )
}
