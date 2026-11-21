export const revalidate = 300

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { TaxonomyHero, TaxonomyPostGrid } from '@/components/taxonomy'
import { getBlogSettings } from '@/lib/blog-settings'
import { buildBreadcrumbJsonLd, buildPageMetadata } from '@/lib/seo'
import { JsonLd } from '@/components/seo/JsonLd'
import { getTagDetail, TAXONOMY_PAGE_SIZE } from '@/lib/taxonomy'
import { clampPagination } from '@/lib/validation'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const [tag, settings] = await Promise.all([getTagDetail(slug), getBlogSettings()])

  if (!tag) {
    return buildPageMetadata({
      title: '标签不存在',
      description: '未找到对应标签专题。',
      path: `/tags/${slug}`,
      siteUrl: settings.siteUrl,
    })
  }

  return buildPageMetadata({
    title: `${tag.name} · 标签专题`,
    description: `浏览与 ${tag.name} 相关的文章、案例和连续阅读入口。`,
    path: `/tags/${tag.slug}`,
    siteUrl: settings.siteUrl,
  })
}

export default async function TagPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams?: Promise<{ page?: string }>
}) {
  const { slug } = await params
  const filters = searchParams ? await searchParams : undefined
  const { page } = clampPagination({ page: filters?.page ?? null, limit: String(TAXONOMY_PAGE_SIZE) })
  const [tag, settings] = await Promise.all([
    getTagDetail(slug, { page, limit: TAXONOMY_PAGE_SIZE }),
    getBlogSettings(),
  ])

  if (!tag) {
    notFound()
  }

  const isOutOfRangePage = tag.posts.length === 0 && tag.pagination.totalPages > 0 && tag.pagination.page > tag.pagination.totalPages
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: '首页', path: '/' },
    { name: '标签', path: '/tags' },
    { name: tag.name, path: `/tags/${tag.slug}` },
  ], { siteUrl: settings.siteUrl })

  return (
    <div className="reader-section">
      <JsonLd data={breadcrumbJsonLd} />
      <TaxonomyHero
        eyebrow="Tag"
        title={`#${tag.name}`}
        description="标签页适合从具体技术点或关键词切入，查看它在站内内容里的关联分布与最新文章。"
        countLabel={`${tag._count.posts} 篇相关文章`}
        primaryHref={`/posts?tag=${encodeURIComponent(tag.slug)}`}
        primaryLabel="在列表页中筛选"
        secondaryHref="/tags"
        secondaryLabel="返回全部标签"
        accent={tag.color ?? undefined}
      />

      {tag.posts.length > 0 ? (
        <TaxonomyPostGrid
          title="与这个标签相关的近期文章"
          description="这些内容按发布时间倒序排列，方便你快速进入与该标签最相关的最新讨论。"
          posts={tag.posts}
        />
      ) : isOutOfRangePage ? (
        <section className="reader-panel p-8 text-sm text-[var(--text-muted)]">
          当前页没有内容。你可以返回
          <Link href={`/tags/${tag.slug}?page=1`} className="reader-link mx-1 font-medium">
            返回第一页
          </Link>
          查看这个标签下更早的文章。
        </section>
      ) : (
        <section className="reader-panel p-8 text-sm text-[var(--text-muted)]">
          这个标签下暂时还没有已发布文章。你可以先返回
          <Link href="/posts" className="reader-link mx-1 font-medium">
            全部文章
          </Link>
          继续浏览其他主题。
        </section>
      )}
    </div>
  )
}
