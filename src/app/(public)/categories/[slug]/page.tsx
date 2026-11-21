export const revalidate = 300

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { EmptyState, TextLink } from '@/components/editorial'
import { getLatestDate, TaxonomyHero, TaxonomyPostGrid } from '@/components/taxonomy'
import { getBlogSettings } from '@/lib/blog-settings'
import { buildBreadcrumbJsonLd, buildPageMetadata } from '@/lib/seo'
import { JsonLd } from '@/components/seo/JsonLd'
import { getCategoryDetail, TAXONOMY_PAGE_SIZE } from '@/lib/taxonomy'
import { clampPagination } from '@/lib/validation'
import { formatIsoDate } from '@/lib/editorial-format'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const [category, settings] = await Promise.all([getCategoryDetail(slug), getBlogSettings()])

  if (!category) {
    return buildPageMetadata({
      title: '分类不存在',
      description: '未找到对应分类专题。',
      path: `/categories/${slug}`,
      siteUrl: settings.siteUrl,
    })
  }

  return buildPageMetadata({
    title: `${category.name} · 分类专题`,
    description: category.description || `浏览 ${category.name} 分类下的最新已发布文章与相关内容。`,
    path: `/categories/${category.slug}`,
    siteUrl: settings.siteUrl,
  })
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams?: Promise<{ page?: string }>
}) {
  const { slug } = await params
  const filters = searchParams ? await searchParams : undefined
  const { page } = clampPagination({ page: filters?.page ?? null, limit: String(TAXONOMY_PAGE_SIZE) })
  const [category, settings] = await Promise.all([
    getCategoryDetail(slug, { page, limit: TAXONOMY_PAGE_SIZE }),
    getBlogSettings(),
  ])

  if (!category) {
    notFound()
  }

  const isOutOfRangePage = category.posts.length === 0 && category.pagination.totalPages > 0 && category.pagination.page > category.pagination.totalPages
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: '首页', path: '/' },
    { name: '分类', path: '/categories' },
    { name: category.name, path: `/categories/${category.slug}` },
  ], { siteUrl: settings.siteUrl })

  const latest = category.pagination.page === 1 ? getLatestDate(category.posts) : null
  const meta = [`${category._count.posts} 篇文章`, latest ? `最近更新 ${formatIsoDate(latest)}` : null].filter(Boolean).join(' · ')
  const basePath = `/categories/${category.slug}`

  return (
    <>
      <JsonLd data={breadcrumbJsonLd} />
      <TaxonomyHero
        eyebrow="分类"
        title={category.name}
        description={category.description || `浏览「${category.name}」分类下的全部已发布文章。`}
        meta={meta}
        links={[
          { href: `/posts?category=${encodeURIComponent(category.slug)}`, label: '在列表页中筛选' },
          { href: '/categories', label: '全部分类' },
        ]}
      />

      <TaxonomyPostGrid
        count={category._count.posts}
        posts={category.posts}
        hideCategory
        pagination={{ page: category.pagination.page, totalPages: category.pagination.totalPages, basePath }}
        empty={
          isOutOfRangePage ? (
            <EmptyState
              title={`第 ${category.pagination.page} 页不存在，这个分类共 ${category.pagination.totalPages} 页`}
              actions={
                <>
                  <TextLink href={`${basePath}?page=1`}>回到第 1 页</TextLink>
                  {category.pagination.totalPages > 1 ? (
                    <TextLink href={`${basePath}?page=${category.pagination.totalPages}`}>
                      {`跳到第 ${category.pagination.totalPages} 页`}
                    </TextLink>
                  ) : null}
                </>
              }
            />
          ) : (
            <EmptyState
              title="这个分类下还没有文章"
              actions={
                <>
                  <TextLink href="/posts">浏览全部文章</TextLink>
                  <TextLink href="/categories">全部分类</TextLink>
                </>
              }
            />
          )
        }
      />
    </>
  )
}
