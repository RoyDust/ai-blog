export const revalidate = 300

import type { Metadata } from 'next'

import { TaxonomyDirectoryCard, TaxonomyHero } from '@/components/taxonomy'
import { buildPageMetadata } from '@/lib/seo'
import { getCategoryDirectory } from '@/lib/taxonomy'

export const metadata: Metadata = buildPageMetadata({
  title: '分类专题',
  description: '围绕内容主题浏览全部分类，快速进入每个专题页并继续阅读相关文章。',
  path: '/categories',
})

export default async function CategoriesPage() {
  const categories = await getCategoryDirectory().catch((error) => {
    console.error('Load categories directory error:', error)
    return []
  })

  const totalPosts = categories.reduce((sum, category) => sum + category._count.posts, 0)

  return (
    <div className="space-y-6">
      <TaxonomyHero
        eyebrow="Categories"
        title="分类专题"
        description="把文章按主题组织成更清晰的阅读路径。你可以从某个专题进入，连续阅读同一方向的内容，而不只是停留在筛选结果页。"
        countLabel={`${categories.length} 个分类 · ${totalPosts} 篇已发布文章`}
        primaryHref="/posts"
        primaryLabel="浏览全部文章"
        secondaryHref="/archives"
        secondaryLabel="查看文章归档"
      />

      {categories.length > 0 ? (
        <section className="grid gap-4">
          {categories.map((category, index) => (
            <div key={category.id} className="onload-animation" style={{ animationDelay: `${80 + index * 30}ms` }}>
              <TaxonomyDirectoryCard
                href={`/categories/${category.slug}`}
                name={category.name}
                description={category.description}
                count={category._count.posts}
                badge="专题分类"
              />
            </div>
          ))}
        </section>
      ) : (
        <section className="card-base p-8 text-sm text-[var(--muted)]">当前还没有可展示的分类专题。</section>
      )}
    </div>
  )
}
