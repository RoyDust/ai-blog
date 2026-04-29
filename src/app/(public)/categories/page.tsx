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

type CategoryDirectoryEntry = Awaited<ReturnType<typeof getCategoryDirectory>>[number]

export default async function CategoriesPage() {
  let categories: Awaited<ReturnType<typeof getCategoryDirectory>> = []
  let hasLoadError = false

  try {
    categories = await getCategoryDirectory()
  } catch (error) {
    hasLoadError = true
    console.error('Load categories directory error:', error)
  }

  const totalPosts = categories.reduce((sum: number, category: CategoryDirectoryEntry) => sum + category._count.posts, 0)

  return (
    <div className="reader-section">
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

      {hasLoadError ? (
        <section role="alert" className="reader-panel border-[var(--danger-border)] bg-[var(--danger-surface)] p-8 text-sm text-[var(--danger-foreground)]">
          分类专题加载失败，请稍后重试。
        </section>
      ) : categories.length > 0 ? (
        <section className="grid gap-4">
          {categories.map((category: CategoryDirectoryEntry, index: number) => (
            <div key={category.id} className="onload-animation" style={{ animationDelay: `${80 + index * 30}ms` }}>
              <TaxonomyDirectoryCard
                href={`/categories/${category.slug}`}
                name={category.name}
                description={category.description}
                count={category._count.posts}
                badge="专题分类"
                accent={index % 2 === 0 ? "var(--accent-warm)" : "var(--accent-cyan)"}
              />
            </div>
          ))}
        </section>
      ) : (
        <section className="reader-panel p-8 text-sm text-[var(--text-muted)]">当前还没有可展示的分类专题。</section>
      )}
    </div>
  )
}
