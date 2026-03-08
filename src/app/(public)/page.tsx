export const revalidate = 300

import type { Metadata } from 'next'
import Link from 'next/link'
import { Archive, Code2, Database, FileText, Palette, User, Zap } from 'lucide-react'

import { HomeLatestPosts } from '@/components/blog'
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
  try {
    const [postsPage, categories] = await Promise.all([
      getPublishedPostsPage({ page: 1, limit: POSTS_PAGE_SIZE }),
      prisma.category.findMany({
        where: { deletedAt: null },
        include: { _count: { select: { posts: { where: { deletedAt: null, published: true } } } } },
        orderBy: { posts: { _count: 'desc' } },
        take: 12,
      }),
    ])

    return { ...postsPage, categories }
  } catch (error) {
    console.error('Load home page data error:', error)
    return {
      posts: [],
      pagination: { page: 1, limit: POSTS_PAGE_SIZE, total: 0, totalPages: 0 },
      categories: [],
    }
  }
}

type HomePost = Awaited<ReturnType<typeof getData>>['posts'][number]
type HomeCategory = Awaited<ReturnType<typeof getData>>['categories'][number]

export default async function Home() {
  const { posts, pagination, categories } = await getData()

  return (
    <div className="space-y-8">
      <HomeLatestPosts initialPagination={pagination} initialPosts={posts as HomePost[]} />

      <section className="card-base onload-animation p-6 md:p-8" style={{ animationDelay: '250ms' }}>
        <h2 className="text-90 mb-6 text-2xl font-bold">浏览分类</h2>
        <div className="flex flex-wrap gap-3">
          {categories.map((category: HomeCategory) => (
            <Link
              key={category.id}
              href={`/categories/${category.slug}`}
              className="rounded-full bg-[var(--btn-regular-bg)] px-4 py-2 text-sm font-medium text-[var(--primary)] transition-all hover:scale-105 hover:bg-[var(--btn-regular-bg-hover)]"
            >
              {category.name} ({category._count.posts})
            </Link>
          ))}
        </div>
      </section>

      <section className="onload-animation grid gap-4 md:grid-cols-3" style={{ animationDelay: '300ms' }}>
        <Link href="/posts" className="card-base group cursor-pointer p-6 transition hover:bg-[var(--btn-card-bg-hover)]">
          <h3 className="text-90 mb-2 flex items-center gap-2 text-xl font-bold transition group-hover:text-[var(--primary)]">
            <FileText className="h-5 w-5 text-[var(--primary)]" />文章
          </h3>
          <p className="text-75 text-sm">阅读技术文章与分步指南。</p>
        </Link>
        <Link href="/categories" className="card-base group cursor-pointer p-6 transition hover:bg-[var(--btn-card-bg-hover)]">
          <h3 className="text-90 mb-2 flex items-center gap-2 text-xl font-bold transition group-hover:text-[var(--primary)]">
            <Archive className="h-5 w-5 text-[var(--primary)]" />归档
          </h3>
          <p className="text-75 text-sm">按主题浏览内容库。</p>
        </Link>
        <Link href="/tags" className="card-base group cursor-pointer p-6 transition hover:bg-[var(--btn-card-bg-hover)]">
          <h3 className="text-90 mb-2 flex items-center gap-2 text-xl font-bold transition group-hover:text-[var(--primary)]">
            <User className="h-5 w-5 text-[var(--primary)]" />标签
          </h3>
          <p className="text-75 text-sm">通过灵活的标签发现主题内容。</p>
        </Link>
      </section>

      <section className="card-base onload-animation p-6 md:p-8" style={{ animationDelay: '350ms' }}>
        <h2 className="text-90 mb-6 text-2xl font-bold">核心特性</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <h3 className="text-90 flex items-center gap-2 font-bold"><Palette className="h-5 w-5 text-primary" />动态主题</h3>
            <p className="text-75 text-sm">语义化颜色令牌、色相调整与明暗主题支持。</p>
          </div>
          <div className="space-y-2">
            <h3 className="text-90 flex items-center gap-2 font-bold"><Zap className="h-5 w-5 text-primary" />Next.js</h3>
            <p className="text-75 text-sm">基于现代 App Router，带来更流畅的阅读体验。</p>
          </div>
          <div className="space-y-2">
            <h3 className="text-90 flex items-center gap-2 font-bold"><Database className="h-5 w-5 text-primary" />Prisma</h3>
            <p className="text-75 text-sm">类型安全的数据访问，支撑稳定的发布流程。</p>
          </div>
          <div className="space-y-2">
            <h3 className="text-90 flex items-center gap-2 font-bold"><Code2 className="h-5 w-5 text-primary" />TypeScript</h3>
            <p className="text-75 text-sm">让重构更安全，并提升整站 UI 一致性。</p>
          </div>
        </div>
      </section>
    </div>
  )
}
