export const revalidate = 300

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { EmptyState, TextLink } from '@/components/editorial'
import { getLatestDate, TaxonomyHero, TaxonomyPostGrid } from '@/components/taxonomy'
import { getBlogSettings } from '@/lib/blog-settings'
import { buildBreadcrumbJsonLd, buildPageMetadata } from '@/lib/seo'
import { JsonLd } from '@/components/seo/JsonLd'
import { getTagDetail, TAXONOMY_PAGE_SIZE } from '@/lib/taxonomy'
import { clampPagination } from '@/lib/validation'
import { formatIsoDate } from '@/lib/editorial-format'

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

  const latest = tag.pagination.page === 1 ? getLatestDate(tag.posts) : null
  const meta = [`${tag._count.posts} 篇文章`, latest ? `最近更新 ${formatIsoDate(latest)}` : null].filter(Boolean).join(' · ')
  const basePath = `/tags/${tag.slug}`

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      <TaxonomyHero
        eyebrow="标签"
        title={tag.name}
        description={`与「${tag.name}」相关的全部已发布文章，按发布时间排列。`}
        meta={meta}
        links={[
          { href: `/posts?tag=${encodeURIComponent(tag.slug)}`, label: '在列表页中筛选' },
          { href: '/tags', label: '全部标签' },
        ]}
      />

      <TaxonomyPostGrid
        count={tag._count.posts}
        posts={tag.posts}
        hideTag
        pagination={{ page: tag.pagination.page, totalPages: tag.pagination.totalPages, basePath }}
        empty={
          isOutOfRangePage ? (
            <EmptyState
              title={`第 ${tag.pagination.page} 页不存在，这个标签共 ${tag.pagination.totalPages} 页`}
              actions={
                <>
                  <TextLink href={`${basePath}?page=1`}>回到第 1 页</TextLink>
                  {tag.pagination.totalPages > 1 ? (
                    <TextLink href={`${basePath}?page=${tag.pagination.totalPages}`}>
                      {`跳到第 ${tag.pagination.totalPages} 页`}
                    </TextLink>
                  ) : null}
                </>
              }
            />
          ) : (
            <EmptyState
              title="这个标签下还没有文章"
              actions={
                <>
                  <TextLink href="/posts">浏览全部文章</TextLink>
                  <TextLink href="/tags">全部标签</TextLink>
                </>
              }
            />
          )
        }
      />
    </>
  )
}
