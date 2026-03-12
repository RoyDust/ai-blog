export const revalidate = 300

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { TaxonomyHero, TaxonomyPostGrid } from '@/components/taxonomy'
import { buildPageMetadata } from '@/lib/seo'
import { getTagDetail } from '@/lib/taxonomy'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const tag = await getTagDetail(slug)

  if (!tag) {
    return buildPageMetadata({
      title: '标签不存在',
      description: '未找到对应标签专题。',
      path: `/tags/${slug}`,
    })
  }

  return buildPageMetadata({
    title: `${tag.name} · 标签专题`,
    description: `浏览与 ${tag.name} 相关的文章、案例和连续阅读入口。`,
    path: `/tags/${tag.slug}`,
  })
}

export default async function TagPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const tag = await getTagDetail(slug)

  if (!tag) {
    notFound()
  }

  return (
    <div className="space-y-6">
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
      ) : (
        <section className="card-base p-8 text-sm text-[var(--muted)]">
          这个标签下暂时还没有已发布文章。你可以先返回
          <Link href="/posts" className="mx-1 font-medium text-[var(--primary)]">
            全部文章
          </Link>
          继续浏览其他主题。
        </section>
      )}
    </div>
  )
}
