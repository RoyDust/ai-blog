export const revalidate = 300

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { TaxonomyHero, TaxonomyPostGrid } from '@/components/taxonomy'
import { buildPageMetadata } from '@/lib/seo'
import { getCategoryDetail } from '@/lib/taxonomy'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const category = await getCategoryDetail(slug)

  if (!category) {
    return buildPageMetadata({
      title: '分类不存在',
      description: '未找到对应分类专题。',
      path: `/categories/${slug}`,
    })
  }

  return buildPageMetadata({
    title: `${category.name} · 分类专题`,
    description: category.description || `浏览 ${category.name} 分类下的最新已发布文章与相关内容。`,
    path: `/categories/${category.slug}`,
  })
}

export default async function CategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const category = await getCategoryDetail(slug)

  if (!category) {
    notFound()
  }

  return (
    <div className="space-y-6">
      <TaxonomyHero
        eyebrow="Category"
        title={category.name}
        description={category.description || '这是一个按主题组织的专题页。你可以在这里连续浏览该方向下的最新文章，并快速回到全站列表继续探索。'}
        countLabel={`${category._count.posts} 篇已发布文章`}
        primaryHref={`/posts?category=${encodeURIComponent(category.slug)}`}
        primaryLabel="在列表页中筛选"
        secondaryHref="/categories"
        secondaryLabel="返回全部分类"
      />

      {category.posts.length > 0 ? (
        <TaxonomyPostGrid
          title={`最新 ${category._count.posts} 篇内容中的近期更新`}
          description="优先展示这个专题下最近发布的文章，帮助你顺着主题继续读下去。"
          posts={category.posts}
        />
      ) : (
        <section className="card-base p-8 text-sm text-[var(--muted)]">
          这个分类下暂时还没有已发布文章。你可以先返回
          <Link href="/posts" className="mx-1 font-medium text-[var(--primary)]">
            全部文章
          </Link>
          看看其他内容。
        </section>
      )}
    </div>
  )
}
